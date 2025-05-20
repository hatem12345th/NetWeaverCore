 
const configs = processTopology(sampleTopology);

console.log(JSON.stringify(configs, null, 2));

function generateSubnet(router1, router2) {
  // Create a consistent hash based on router names to ensure the same pair always gets the same subnet
  const routerPair = [router1, router2].sort().join('');
  
  // Simple hash function to generate subnet
  let hash = 0;
  for (let i = 0; i < routerPair.length; i++) {
    hash = ((hash << 5) - hash) + routerPair.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Use hash to generate a subnet in 10.0.x.0/24 range
  const subnetNum = Math.abs(hash % 250) + 1; // Range 1-250
  return `10.0.${subnetNum}.0/24`;
}

// Function to get IP address within a subnet
function getIPFromSubnet(subnet, isFirst) {
  const baseSubnet = subnet.split('/')[0];
  const parts = baseSubnet.split('.');
  const lastOctet = isFirst ? '1' : '2';
  return `${parts[0]}.${parts[1]}.${parts[2]}.${lastOctet}`;
}

// Function to convert subnet mask from CIDR to dotted decimal
function cidrToSubnetMask(cidr) {
  const mask = parseInt(cidr.split('/')[1]);
  const bits = '1'.repeat(mask) + '0'.repeat(32 - mask);
  const octets = [];
  
  for (let i = 0; i < 32; i += 8) {
    octets.push(parseInt(bits.substr(i, 8), 2));
  }
  
  return octets.join('.');
}

// Function to get wildcard mask from subnet mask
function getWildcardMask(subnetMask) {
  return subnetMask.split('.').map(octet => 255 - parseInt(octet)).join('.');
}

// Function to generate device configurations
function generateDeviceConfigs(topology) {
  const configs = [];
  const subnetMappings = {};
  const deviceTypes = {};
  const isRouter = {};
  const routerInterfaces = {};
  const pcConnections = {};
  const networks = new Set();
  
  // Identify device types (router, switch, PC)
  topology.nodes.forEach(node => {
    deviceTypes[node.name] = node.name.startsWith('R') ? 'router' : 
                            node.name.startsWith('Switch') ? 'switch' : 'pc';
    isRouter[node.name] = node.name.startsWith('R');
    
    // Initialize router interfaces collection
    if (isRouter[node.name]) {
      routerInterfaces[node.name] = {};
    }
  });

  // Generate subnet mappings for direct router-to-router connections
  topology.links.forEach(link => {
    const [endpoint1, endpoint2] = link.split(' <--> ');
    const [device1, int1] = endpoint1.split(' (');
    const interface1 = int1.replace(')', '');
    const [device2, int2] = endpoint2.split(' (');
    const interface2 = int2.replace(')', '');
    
    // Only create subnets for router-to-router connections
    if (isRouter[device1] && isRouter[device2]) {
      const subnet = generateSubnet(device1, device2);
      const key = `${device1}-${device2}`;
      const reversedKey = `${device2}-${device1}`;
      
      subnetMappings[key] = {
        subnet: subnet,
        device1IP: getIPFromSubnet(subnet, true),
        device2IP: getIPFromSubnet(subnet, false),
        interface1: interface1,
        interface2: interface2
      };
      
      subnetMappings[reversedKey] = {
        subnet: subnet,
        device1IP: getIPFromSubnet(subnet, false),
        device2IP: getIPFromSubnet(subnet, true),
        interface1: interface2,
        interface2: interface1
      };
      
      networks.add(subnet);
      
      // Store interface information
      routerInterfaces[device1][interface1] = {
        connectedTo: device2,
        subnet: subnet,
        ip: getIPFromSubnet(subnet, true)
      };
      
      routerInterfaces[device2][interface2] = {
        connectedTo: device1,
        subnet: subnet,
        ip: getIPFromSubnet(subnet, false)
      };
    }
  });

  // Generate LAN subnets for router-to-switch connections
  topology.links.forEach(link => {
    const [endpoint1, endpoint2] = link.split(' <--> ');
    const [device1, int1] = endpoint1.split(' (');
    const interface1 = int1.replace(')', '');
    const [device2, int2] = endpoint2.split(' (');
    const interface2 = int2.replace(')', '');
    
    if ((deviceTypes[device1] === 'router' && deviceTypes[device2] === 'switch') || 
        (deviceTypes[device2] === 'router' && deviceTypes[device1] === 'switch')) {
      const router = deviceTypes[device1] === 'router' ? device1 : device2;
      const routerInterface = deviceTypes[device1] === 'router' ? interface1 : interface2;
      const switchDevice = deviceTypes[device1] === 'switch' ? device1 : device2;
      const switchInterface = deviceTypes[device1] === 'switch' ? interface1 : interface2;
      
      const subnet = generateSubnet(router, switchDevice);
      const lanSubnet = subnet;
      
      if (!subnetMappings[`${router}-${switchDevice}`]) {
        subnetMappings[`${router}-${switchDevice}`] = {
          subnet: lanSubnet,
          device1IP: getIPFromSubnet(lanSubnet, true),
          interface1: routerInterface,
          interface2: switchInterface
        };
        
        subnetMappings[`${switchDevice}-${router}`] = {
          subnet: lanSubnet,
          device2IP: getIPFromSubnet(lanSubnet, true),
          interface1: switchInterface,
          interface2: routerInterface
        };
        
        networks.add(lanSubnet);
        
        // Store interface information
        routerInterfaces[router][routerInterface] = {
          connectedTo: switchDevice,
          subnet: lanSubnet,
          ip: getIPFromSubnet(lanSubnet, true),
          isLAN: true
        };
      }
    }
  });

  // Generate PC connections and IP addresses
  topology.links.forEach(link => {
    const [endpoint1, endpoint2] = link.split(' <--> ');
    const [device1, int1] = endpoint1.split(' (');
    const interface1 = int1.replace(')', '');
    const [device2, int2] = endpoint2.split(' (');
    const interface2 = int2.replace(')', '');
    
    if (deviceTypes[device1] === 'pc' && deviceTypes[device2] === 'switch') {
      pcConnections[device1] = {
        connectedTo: device2,
        pcInterface: interface1,
        switchInterface: interface2
      };
    } else if (deviceTypes[device2] === 'pc' && deviceTypes[device1] === 'switch') {
      pcConnections[device2] = {
        connectedTo: device1,
        pcInterface: interface2,
        switchInterface: interface1
      };
    }
  });

  // Find router for each PC and assign IP addresses
  Object.keys(pcConnections).forEach(pc => {
    const connectedSwitch = pcConnections[pc].connectedTo;
    let routerForPC = null;
    let routerInterface = null;
    
    // Find the router connected to this switch
    topology.links.forEach(link => {
      const [endpoint1, endpoint2] = link.split(' <--> ');
      const [device1, int1] = endpoint1.split(' (');
      const [device2, int2] = endpoint2.split(' (');
      
      if (device1 === connectedSwitch && deviceTypes[device2] === 'router') {
        routerForPC = device2;
        routerInterface = int2.replace(')', '');
      } else if (device2 === connectedSwitch && deviceTypes[device1] === 'router') {
        routerForPC = device1;
        routerInterface = int1.replace(')', '');
      }
    });
    
    if (routerForPC) {
      const subnet = routerInterfaces[routerForPC][routerInterface]?.subnet;
      const routerIP = routerInterfaces[routerForPC][routerInterface]?.ip;
      
      if (subnet) {
        // For PC, use .10, .11, etc.
        const pcNum = parseInt(pc.replace('PC', ''));
        const pcIP = `${subnet.split('.0/')[0]}.${10 + pcNum}`;
        
        pcConnections[pc].subnet = subnet;
        pcConnections[pc].ip = pcIP;
        pcConnections[pc].gateway = routerIP;
        pcConnections[pc].routerName = routerForPC;
      }
    }
  });

  // Generate router configurations
  Object.keys(routerInterfaces).forEach(routerName => {
    const routerNumber = parseInt(routerName.replace('R', ''));
    const routerCommands = [];
    
    // Basic configuration
    routerCommands.push({ cmd: 'configure terminal', prompt: '(config)#' });
    
    // Configure Loopback for router ID
    routerCommands.push({ cmd: 'interface Loopback0', prompt: '(config-if)#' });
    routerCommands.push({ cmd: `ip address ${routerNumber}.${routerNumber}.${routerNumber}.${routerNumber} 255.255.255.255`, prompt: '(config-if)#' });
    routerCommands.push({ cmd: 'exit', prompt: '(config)#' });
    
    // Configure interfaces
    Object.keys(routerInterfaces[routerName]).forEach(interfaceName => {
      const interfaceInfo = routerInterfaces[routerName][interfaceName];
      const subnetCIDR = interfaceInfo.subnet;
      const subnetMask = cidrToSubnetMask(subnetCIDR);
      
      // Configure interface
      const interfaceType = interfaceName.startsWith('f') ? 'FastEthernet' : 
                           interfaceName.startsWith('s') ? 'Serial' : 'GigabitEthernet';
      const fullInterfaceName = `${interfaceType}${interfaceName.substring(1)}`;
      
      routerCommands.push({ cmd: `interface ${fullInterfaceName}`, prompt: '(config-if)#' });
      routerCommands.push({ cmd: `ip address ${interfaceInfo.ip} ${subnetMask}`, prompt: '(config-if)#' });
      routerCommands.push({ cmd: 'no shutdown', prompt: '(config-if)#' });
      
      // DCE interface must have clock rate set (assuming Serial0/0 is DCE on all routers)
      if (interfaceName === 's0/0') {
        routerCommands.push({ cmd: 'clock rate 64000', prompt: '(config-if)#' });
      }
      
      routerCommands.push({ cmd: 'exit', prompt: '(config)#' });
    });
    
    // Configure OSPF
    routerCommands.push({ cmd: 'router ospf 1', prompt: '(config-router)#' });
    
    // Add loopback to OSPF
    routerCommands.push({ cmd: `network ${routerNumber}.${routerNumber}.${routerNumber}.${routerNumber} 0.0.0.0 area 0`, prompt: '(config-router)#' });
    
    // Add all interfaces to OSPF
    Object.keys(routerInterfaces[routerName]).forEach(interfaceName => {
      const interfaceInfo = routerInterfaces[routerName][interfaceName];
      const subnetCIDR = interfaceInfo.subnet;
      const subnetBase = subnetCIDR.split('/')[0];
      const wildcard = getWildcardMask(cidrToSubnetMask(subnetCIDR));
      
      routerCommands.push({ cmd: `network ${subnetBase} ${wildcard} area 0`, prompt: '(config-router)#' });
    });
    
    routerCommands.push({ cmd: 'exit', prompt: '(config)#' });
    routerCommands.push({ cmd: 'end', prompt: '#' });
    routerCommands.push({ cmd: 'write memory', prompt: '#' });
    
    // Add verification commands
    routerCommands.push({ cmd: 'show ip interface brief', prompt: '#' });
    routerCommands.push({ cmd: 'show ip ospf neighbor', prompt: '#' });
    routerCommands.push({ cmd: 'show ip route ospf', prompt: '#' });
    
    configs.push({
      name: routerName,
      port: topology.nodes.find(node => node.name === routerName).console,
      commands: routerCommands
    });
  });

  // Generate PC configurations
  Object.keys(pcConnections).forEach(pcName => {
    const pcInfo = pcConnections[pcName];
    const subnetMask = cidrToSubnetMask(pcInfo.subnet);
    const pcCommands = [
      { cmd: `ip ${pcInfo.ip} ${subnetMask} ${pcInfo.gateway}`, prompt: />/ },
      { cmd: `ping ${pcInfo.gateway}`, prompt: />/ },
      { cmd: 'show', prompt: />/ }
    ];
    
    configs.push({
      name: pcName,
      port: topology.nodes.find(node => node.name === pcName).console,
      commands: pcCommands
    });
  });

  return configs;
}

// Main function to process topology and generate configurations
function processTopology(topologyData) {
  // Parse the topology data if it's a string
  const topology = typeof topologyData === 'string' ? JSON.parse(topologyData) : topologyData;
  
  // Generate configurations for all devices
  const deviceConfigs = generateDeviceConfigs(topology);
  
  return deviceConfigs;
}



export  {
  processTopology
};
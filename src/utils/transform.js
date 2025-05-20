
export const TopologyJson = (inputJson) => {
  const outputJson = {
    nodes: [],
    links: []
  };

  const nodeMap = {};
  inputJson.topology.nodes.forEach(device => {
    nodeMap[device.node_id] = {
      name: device.name,
      interfaces: [],
      x: device.x,
      y: device.y,
      console: device.console
    };
  });

  const fastEthCount = {};
  const serialCount = {};

  inputJson.topology.links.forEach(link => {
    if (link.nodes.length !== 2) return;

    const [n1, n2] = link.nodes;
    const dev1 = nodeMap[n1.node_id];
    const dev2 = nodeMap[n2.node_id];

    // Determine link type based on device names (simple logic)
    const isRouter1 = dev1.name.toLowerCase().startsWith("r");
    const isRouter2 = dev2.name.toLowerCase().startsWith("r");
    const linkType = isRouter1 && isRouter2 ? "serial" : "fastethernet";

    // Set up counters
    if (!fastEthCount[dev1.name]) fastEthCount[dev1.name] = 0;
    if (!fastEthCount[dev2.name]) fastEthCount[dev2.name] = 0;
    if (!serialCount[dev1.name]) serialCount[dev1.name] = 0;
    if (!serialCount[dev2.name]) serialCount[dev2.name] = 0;

    // Assign interface names
    let int1, int2;

    if (linkType === "serial") {
      int1 = `s0/${serialCount[dev1.name]++}`;
      int2 = `s0/${serialCount[dev2.name]++}`;
    } else {
      int1 = `f0/${fastEthCount[dev1.name]++}`;
      int2 = `f0/${fastEthCount[dev2.name]++}`;
    }

    dev1.interfaces.push({
      name: int1,
      connectedTo: dev2.name
    });

    dev2.interfaces.push({
      name: int2,
      connectedTo: dev1.name
    });

    outputJson.links.push(`${dev1.name} (${int1}) <--> ${dev2.name} (${int2})`);
  });

  // Push to output
  for (const id in nodeMap) {
    outputJson.nodes.push(nodeMap[id]);
  }

  return outputJson;
};

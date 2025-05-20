export function convertGNS3ToReactFlow(gns3Topology) {
  const reactFlow = {
    nodes: [],
    edges: []
  };

  const idMap = {}; // maps original device name to id (used for edges)

  gns3Topology.nodes.forEach((device, index) => {
    const nodeId = device.name.toLowerCase();
    idMap[device.name] = nodeId;

    const ports = device.interfaces.map((iface, i) => ({
      id: `port-${nodeId}-${i}`,
      type: i % 2 === 0 ? "source" : "target", // alternate source/target
      label: iface.name
    }));

    const reactNode = {
      id: nodeId,
      type: getNodeType(device.name),
      position: { x: device.x, y: device.y },
      data: {
        label: device.name,
        ports,
        interfaces: device.interfaces.map(iface => ({
          name: iface.name,
          description: `Connected to ${iface.connectedTo}`,
          status: "Up"
        })),
        routingProtocols: [] // optional, fill if needed
      }
    };

    reactFlow.nodes.push(reactNode);
  });

  // Build edges from link strings
  gns3Topology.links.forEach((link, index) => {
    const match = link.match(/(\w+)\s\(([^)]+)\)\s<-->\s(\w+)\s\(([^)]+)\)/);
    if (!match) return;

    const [, srcName, srcPort, tgtName, tgtPort] = match;

    const sourceId = idMap[srcName];
    const targetId = idMap[tgtName];

    const sourceNode = reactFlow.nodes.find(n => n.id === sourceId);
    const targetNode = reactFlow.nodes.find(n => n.id === targetId);

    const sourceHandle = sourceNode?.data?.ports.find(p => p.label === srcPort)?.id;
    const targetHandle = targetNode?.data?.ports.find(p => p.label === tgtPort)?.id;

    reactFlow.edges.push({
      id: `e-${sourceId}-${targetId}-${index}`,
      source: sourceId,
      target: targetId,
      sourceHandle: sourceHandle || null,
      targetHandle: targetHandle || null,
      type: "default", // or "ethernet" / "serial" depending on logic
      markerEnd: { type: "arrowclosed", color: "#4B5563" },
      style: { stroke: "#4B5563" }
    });
  });

  return reactFlow;
}

function getNodeType(name) {
  const lower = name.toLowerCase();
  if (lower.startsWith("r")) return "router";
  if (lower.startsWith("s")) return "switch";
  if (lower.startsWith("pc")) return "client";
  return "device";
}








import { Router } from 'express';
import { TopologyJson } from '../utils/transform.js';
import { convertGNS3ToReactFlow } from '../utils/transformToReact.js';
import { processTopology } from '../config/ospf/gns3-ospf-converter.js';

const router = Router();

router.post('/generate-topology', (req, res) => {
  try {
    const output = TopologyJson(req.body.topologyGns3);
    const topology = convertGNS3ToReactFlow(output)
    res.json({
      success: true,
      topology: topology
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

router.post('/config-ospf',(req,res) => {
 try {
    const output = TopologyJson(req.body.topologyGns3);
    const config = processTopology(output)
    res.json({
      success: true,
      topology: config
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
})

export default router;

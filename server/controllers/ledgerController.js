import { LedgerCoordinatorService } from '../services/ledgerCoordinatorService.js';
import { FabricGatewayService } from '../services/fabricGatewayService.js';
import { AuditService } from '../services/auditService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

export class LedgerController {
  static async getFabricNetworkStatus(req, res) {
    try {
      const status = await FabricGatewayService.getNetworkStatus();
      return successResponse(res, 'Hyperledger Fabric Network Status retrieved', status);
    } catch (err) {
      return errorResponse(res, err.message, null, 500);
    }
  }

  static async getFabricBlocks(req, res) {
    try {
      const blocks = await FabricGatewayService.getFabricBlocks();
      return successResponse(res, 'Hyperledger Fabric Channel Blocks retrieved', blocks);
    } catch (err) {
      return errorResponse(res, err.message, null, 500);
    }
  }

  static async getFabricHistoryForKey(req, res) {
    try {
      const { docId } = req.params;
      const history = await FabricGatewayService.evaluateTransaction('GetHistoryForKey', { docId });
      return successResponse(res, `Hyperledger Fabric provenance history for key ${docId}`, history);
    } catch (err) {
      return errorResponse(res, err.message, null, 500);
    }
  }

  static async getLedgerOverview(req, res) {
    try {
      const overview = await LedgerCoordinatorService.getFullLedgerOverview();
      return successResponse(res, 'Hyperledger Fabric Consortium Ledger status retrieved', overview);
    } catch (err) {
      return errorResponse(res, err.message, null, 500);
    }
  }

  static async getSystemMetrics(req, res) {
    try {
      const metrics = await AuditService.getSystemMetrics();
      return successResponse(res, 'Consortium metrics and peer health retrieved', metrics);
    } catch (err) {
      return errorResponse(res, err.message, null, 500);
    }
  }

  static async verifyConsensus(req, res) {
    try {
      const { docId } = req.params;
      const result = await LedgerCoordinatorService.verifyConsensus(docId);
      return successResponse(res, `Fabric Consortium 2-of-3 verification completed for ${docId}`, result);
    } catch (err) {
      return errorResponse(res, err.message, null, 500);
    }
  }

  static async simulateNodeTamper(req, res) {
    try {
      const { docId } = req.params;
      const { nodeId, mspId } = req.body;
      const target = mspId || (Number(nodeId) === 1 ? 'PoliceMSP' : Number(nodeId) === 3 ? 'JudiciaryMSP' : 'ForensicsMSP');
      const result = await FabricGatewayService.simulatePeerTamper(docId, target);
      return successResponse(res, `Simulated Byzantine state corruption on MSP [${target}]`, result);
    } catch (err) {
      return errorResponse(res, err.message, null, 400);
    }
  }

  static async simulateFileTamper(req, res) {
    try {
      const { docId } = req.params;
      const result = await FabricGatewayService.simulateFileTamper(docId);
      return successResponse(res, `Simulated disk byte tampering on document ${docId}`, result);
    } catch (err) {
      return errorResponse(res, err.message, null, 400);
    }
  }

  static async healNodeIntegrity(req, res) {
    try {
      const { docId } = req.params;
      const result = await FabricGatewayService.reconcilePeerState(docId);
      return successResponse(res, `Fabric Peer World States reconciled and healed for ${docId}`, result);
    } catch (err) {
      return errorResponse(res, err.message, null, 400);
    }
  }

  static async invokeChaincode(req, res) {
    try {
      const { functionName, args } = req.body;
      if (!functionName) {
        return errorResponse(res, 'functionName is required for chaincode invocation', null, 400);
      }
      const result = await FabricGatewayService.submitTransaction(functionName, args || {}, req.user);
      return successResponse(res, `Fabric Chaincode function "${functionName}" invoked successfully`, result);
    } catch (err) {
      return errorResponse(res, err.message, null, 400);
    }
  }

  static async queryChaincode(req, res) {
    try {
      const { functionName, args } = req.body;
      if (!functionName) {
        return errorResponse(res, 'functionName is required for chaincode query', null, 400);
      }
      const result = await FabricGatewayService.evaluateTransaction(functionName, args || {}, req.user);
      return successResponse(res, `Fabric Chaincode function "${functionName}" evaluated successfully`, result);
    } catch (err) {
      return errorResponse(res, err.message, null, 400);
    }
  }
}

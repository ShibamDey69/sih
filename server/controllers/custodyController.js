import { CustodyService } from '../services/custodyService.js';
import { recentAuditLogs } from '../middlewares/morganMiddleware.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

export class CustodyController {
  static async transferCustody(req, res) {
    try {
      const { documentId, toActorId, transferReason, transferLocation, acknowledgementNote } = req.body;

      if (!documentId || !toActorId) {
        return errorResponse(res, 'Document ID and Recipient Actor ID are required.', null, 400);
      }

      const result = await CustodyService.transferCustody(
        {
          documentId,
          toActorId,
          transferReason,
          transferLocation,
          acknowledgementNote,
        },
        req.user
      );

      return successResponse(res, 'Custody hand-off logged and ledger committed', result, 201);
    } catch (err) {
      return errorResponse(res, err.message, null, 400);
    }
  }

  static async getCustodyTrail(req, res) {
    try {
      const { docId } = req.params;
      const trail = await CustodyService.getCustodyTrail(docId);
      return successResponse(res, 'Chain of custody trail retrieved', trail);
    } catch (err) {
      return errorResponse(res, err.message, null, 500);
    }
  }

  static async getAuditLogs(req, res) {
    try {
      return successResponse(res, 'Morgan custody access and HTTP audit logs retrieved', {
        total: recentAuditLogs.length,
        logs: recentAuditLogs,
      });
    } catch (err) {
      return errorResponse(res, err.message, null, 500);
    }
  }
}

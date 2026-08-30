import { CaseService } from '../services/caseService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

export class CaseController {
  static async getAllCases(req, res) {
    try {
      const filters = {
        status: req.query.status,
        policeStation: req.query.policeStation,
      };
      const cases = await CaseService.getAllCases(filters);
      return successResponse(res, 'Cases retrieved successfully', cases);
    } catch (err) {
      return errorResponse(res, err.message, null, 500);
    }
  }

  static async getCaseById(req, res) {
    try {
      const { caseId } = req.params;
      const caseRecord = await CaseService.getCaseById(caseId);
      return successResponse(res, 'Case details retrieved', caseRecord);
    } catch (err) {
      return errorResponse(res, err.message, null, 404);
    }
  }

  static async createCase(req, res) {
    try {
      const newCase = await CaseService.createCase(req.body, req.user);
      return successResponse(res, 'Case registered and FIR logged', newCase, 201);
    } catch (err) {
      return errorResponse(res, err.message, null, 400);
    }
  }

  static async updateCaseStatus(req, res) {
    try {
      const { caseId } = req.params;
      const { status } = req.body;
      if (!status) {
        return errorResponse(res, 'Status field is required', null, 400);
      }
      const updated = await CaseService.updateCaseStatus(caseId, status);
      return successResponse(res, 'Case status updated', updated);
    } catch (err) {
      return errorResponse(res, err.message, null, 400);
    }
  }
}

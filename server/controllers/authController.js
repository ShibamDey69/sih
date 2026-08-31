import { AuthService } from '../services/authService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

export class AuthController {
  static async login(req, res) {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        return errorResponse(res, 'Identifier (email/badge) and password are required.', null, 400);
      }
      const result = await AuthService.login(identifier, password);
      return successResponse(res, 'Login successful', result);
    } catch (err) {
      return errorResponse(res, err.message, null, 401);
    }
  }

  static async quickLoginAsRole(req, res) {
    try {
      const { role } = req.params;
      const result = await AuthService.quickLoginAsRole(role);
      return successResponse(res, `Switched persona to ${role}`, result);
    } catch (err) {
      return errorResponse(res, err.message, null, 400);
    }
  }

  static async getMe(req, res) {
    try {
      console.log(req.user);
      const user = await AuthService.getUserById(req.user.id);
      return successResponse(res, 'Current user profile retrieved', user);
    } catch (err) {
      return errorResponse(res, err.message, null, 500);
    }
  }

  static async getAllActors(req, res) {
    try {
      const actors = await AuthService.getAllActors();
      return successResponse(res, 'Authorized actors list retrieved', actors);
    } catch (err) {
      return errorResponse(res, err.message, null, 500);
    }
  }
}

import { UserService } from '../services/userService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

export class UserController {
  static async getAllUsers(req, res) {
    try {
      const { role, department, search } = req.query;
      const users = await UserService.getAllUsers({ role, department, search });
      return successResponse(res, 'Users retrieved successfully', users);
    } catch (err) {
      return errorResponse(res, err.message, null, 500);
    }
  }

  static async getUserById(req, res) {
    try {
      const { id } = req.params;
      const user = await UserService.getUserById(id);
      return successResponse(res, 'User profile retrieved successfully', user);
    } catch (err) {
      return errorResponse(res, err.message, null, 404);
    }
  }

  static async createUser(req, res) {
    try {
      const newUser = await UserService.createUser(req.body);
      return successResponse(res, 'User created successfully', newUser, 201);
    } catch (err) {
      return errorResponse(res, err.message, null, 400);
    }
  }

  static async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updatedUser = await UserService.updateUser(id, req.body);
      return successResponse(res, 'User updated successfully', updatedUser);
    } catch (err) {
      return errorResponse(res, err.message, null, 400);
    }
  }

  static async deleteUser(req, res) {
    try {
      const { id } = req.params;
      const deleted = await UserService.deleteUser(id);
      return successResponse(res, 'User deleted successfully', deleted);
    } catch (err) {
      return errorResponse(res, err.message, null, 404);
    }
  }
}

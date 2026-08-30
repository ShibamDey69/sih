import { SearchService } from '../services/searchService.js';
import { successResponse, errorResponse } from '../utils/responseHelper.js';

export class SearchController {
  static async search(req, res) {
    try {
      const query = req.query.q || req.query.query || '';
      const results = await SearchService.search(query);
      return successResponse(res, 'Search completed', results);
    } catch (err) {
      return errorResponse(res, err.message, null, 500);
    }
  }
}

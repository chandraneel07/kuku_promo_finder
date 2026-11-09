const fs = require('fs');
const path = require('path');

class ReviewService {
  constructor() {
    this.showsBaseDir = path.join(__dirname, '..', '..', 'data', 'shows');
  }

  getReviewFilePath(showId) {
    return path.join(this.showsBaseDir, showId, 'reviews.json');
  }

  getReviews(showId) {
    const filePath = this.getReviewFilePath(showId);
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    } catch (e) {
      console.warn(`[ReviewService] Error loading reviews for ${showId}:`, e.message);
    }
    return {};
  }

  saveReview(showId, promoId, reviewData) {
    const filePath = this.getReviewFilePath(showId);
    const reviews = this.getReviews(showId);

    const existing = reviews[promoId] || {};
    reviews[promoId] = {
      status: reviewData.status || existing.status || 'unreviewed',
      boundary_adjustment: reviewData.boundary_adjustment || existing.boundary_adjustment || { start_delta_sec: 0, end_delta_sec: 0 },
      notes: reviewData.notes !== undefined ? reviewData.notes : (existing.notes || ''),
      reviewed_at: new Date().toISOString()
    };

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(reviews, null, 2), 'utf8');

    return reviews[promoId];
  }
}

module.exports = new ReviewService();

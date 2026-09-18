import { useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';

type RatingDialogProps = {
  restaurantName: string;
  currentRating: number | undefined;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (rating: number) => void;
  onRemove: () => void;
};

export function RatingDialog({ restaurantName, currentRating, busy, error, onClose, onSave, onRemove }: RatingDialogProps) {
  const [rating, setRating] = useState(currentRating ?? 0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="rating-title">
        <button className="icon-button dialog-close" type="button" onClick={onClose} aria-label="Close rating dialog" title="Close">
          <X size={19} aria-hidden="true" />
        </button>
        <p className="section-kicker">Your pizza rating</p>
        <h2 id="rating-title">{restaurantName}</h2>
        <div className="rating-choices" role="group" aria-label="Rating from 1 to 5 stars">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              className={value <= rating ? 'rating-star selected' : 'rating-star'}
              type="button"
              aria-pressed={rating === value}
              aria-label={`${value} star${value === 1 ? '' : 's'}`}
              title={`${value} star${value === 1 ? '' : 's'}`}
              key={value}
              onClick={() => setRating(value)}
              disabled={busy}
            >
              <Star size={34} strokeWidth={1.6} fill={value <= rating ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
          ))}
        </div>
        {error && <p className="form-message" role="alert">{error}</p>}
        <div className="dialog-actions">
          {currentRating !== undefined && <button className="text-button" type="button" onClick={onRemove} disabled={busy}>Remove rating</button>}
          <button className="primary-button" type="button" onClick={() => onSave(rating)} disabled={busy || rating === 0}>
            {busy ? 'Saving...' : 'Save rating'}
          </button>
        </div>
      </section>
    </div>
  );
}

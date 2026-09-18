import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

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
  const [hoverRating, setHoverRating] = useState<number | null>(null);

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
        <div className="rating-choices" role="group" aria-label="Rating from 1 to 5 pizza slices" onMouseLeave={() => setHoverRating(null)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              className={value <= (hoverRating ?? rating) ? 'rating-slice selected' : 'rating-slice'}
              type="button"
              aria-pressed={rating === value}
              aria-label={`${value} slice${value === 1 ? '' : 's'}`}
              title={`${value} slice${value === 1 ? '' : 's'}`}
              key={value}
              onClick={() => setRating(value)}
              onMouseEnter={() => setHoverRating(value)}
              disabled={busy}
            >
              <img src="/pizza-slice.png" alt="" aria-hidden="true" />
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

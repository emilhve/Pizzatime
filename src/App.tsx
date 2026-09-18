import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LogOut, Star, UserRound } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AuthDialog } from './AuthDialog';
import { RatingDialog } from './RatingDialog';
import { supabase } from './lib/supabase';

type Restaurant = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
};

type RatingSummary = {
  restaurant_id: string;
  average_rating: string | number;
  rating_count: number;
};

async function fetchRatingSummaries(): Promise<Record<string, RatingSummary>> {
  const { data, error } = await supabase.rpc('get_restaurant_rating_averages');
  if (error) throw error;

  const summaries = (data ?? []) as RatingSummary[];
  return Object.fromEntries(summaries.map((item) => [item.restaurant_id, item]));
}

function App() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [ratingSummaries, setRatingSummaries] = useState<Record<string, RatingSummary>>({});
  const [summaryStatus, setSummaryStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [authOpen, setAuthOpen] = useState(false);
  const [ratingRestaurant, setRatingRestaurant] = useState<Restaurant | null>(null);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingError, setRatingError] = useState('');
  const activeUserId = useRef<string | null>(null);
  const summaryRequestId = useRef(0);

  const refreshRatingSummaries = useCallback(async () => {
    const requestId = ++summaryRequestId.current;
    try {
      const summaries = await fetchRatingSummaries();
      if (requestId !== summaryRequestId.current) return;
      setRatingSummaries(summaries);
      setSummaryStatus('ready');
    } catch {
      if (requestId !== summaryRequestId.current) return;
      setRatingSummaries({});
      setSummaryStatus('error');
    }
  }, []);

  useEffect(() => {
    let active = true;
    const requestId = ++summaryRequestId.current;

    void fetchRatingSummaries().then((summaries) => {
      if (!active || requestId !== summaryRequestId.current) return;
      setRatingSummaries(summaries);
      setSummaryStatus('ready');
    }).catch(() => {
      if (!active || requestId !== summaryRequestId.current) return;
      setRatingSummaries({});
      setSummaryStatus('error');
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function refreshOnFocus() {
      void refreshRatingSummaries();
    }

    window.addEventListener('focus', refreshOnFocus);
    return () => window.removeEventListener('focus', refreshOnFocus);
  }, [refreshRatingSummaries]);

  useEffect(() => {
    let active = true;

    async function loadRestaurants() {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, address, latitude, longitude')
        .order('name');

      if (!active) return;

      if (error) {
        setStatus('error');
      } else {
        setRestaurants(data ?? []);
        setStatus('ready');
      }
    }

    void loadRestaurants();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      if (nextSession?.user.id !== activeUserId.current) {
        activeUserId.current = nextSession?.user.id ?? null;
        setUsername(null);
        setRatings({});
        setRatingRestaurant(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;

    let active = true;

    async function loadAccount() {
      const [profileResult, ratingsResult] = await Promise.all([
        supabase.from('users').select('username').eq('user_id', userId).single(),
        supabase.from('userratings').select('restaurant_id, rating').eq('user_id', userId),
      ]);

      if (!active) return;

      setUsername(profileResult.data?.username ?? null);
      if (!ratingsResult.error) {
        setRatings(Object.fromEntries((ratingsResult.data ?? []).map((item) => [item.restaurant_id, item.rating])));
      }
    }

    void loadAccount();

    return () => {
      active = false;
    };
  }, [session?.user.id]);

  const filteredRestaurants = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return restaurants;

    return restaurants.filter((restaurant) =>
      `${restaurant.name} ${restaurant.address ?? ''}`.toLocaleLowerCase().includes(term),
    );
  }, [query, restaurants]);

  function openRating(restaurant: Restaurant) {
    if (!session) {
      setAuthOpen(true);
      return;
    }

    setRatingError('');
    setRatingRestaurant(restaurant);
  }

  async function saveRating(rating: number) {
    const userId = session?.user.id;
    const restaurantId = ratingRestaurant?.id;
    if (!userId || !restaurantId) return;

    setRatingBusy(true);
    setRatingError('');

    const result = ratings[restaurantId] === undefined
      ? await supabase.from('userratings').insert({ user_id: userId, restaurant_id: restaurantId, rating })
      : await supabase.from('userratings').update({ rating }).eq('user_id', userId).eq('restaurant_id', restaurantId);

    setRatingBusy(false);
    if (result.error) {
      setRatingError(result.error.message);
      return;
    }

    setRatings((current) => ({ ...current, [restaurantId]: rating }));
    void refreshRatingSummaries();
    setRatingRestaurant(null);
  }

  async function removeRating() {
    const userId = session?.user.id;
    const restaurantId = ratingRestaurant?.id;
    if (!userId || !restaurantId) return;

    setRatingBusy(true);
    setRatingError('');
    const { error } = await supabase.from('userratings').delete().eq('user_id', userId).eq('restaurant_id', restaurantId);
    setRatingBusy(false);

    if (error) {
      setRatingError(error.message);
      return;
    }

    setRatings((current) => {
      const next = { ...current };
      delete next[restaurantId];
      return next;
    });
    void refreshRatingSummaries();
    setRatingRestaurant(null);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <span className="topbar-mark" aria-hidden="true" />
        <span>PADOVA, ITALY</span>
        <div className="account-actions">
          {authReady && (session ? (
            <>
              <span className="account-name"><UserRound size={16} aria-hidden="true" /><span className="account-username">{username ?? 'Account'}</span></span>
              <button className="icon-button" type="button" onClick={() => void supabase.auth.signOut()} aria-label="Sign out" title="Sign out">
                <LogOut size={18} aria-hidden="true" />
              </button>
            </>
          ) : (
            <button className="account-button" type="button" onClick={() => setAuthOpen(true)}>
              <UserRound size={16} aria-hidden="true" /> Sign in
            </button>
          ))}
        </div>
      </header>

      <section className="intro" aria-labelledby="page-title">
        <p className="eyebrow">Find your next slice</p>
        <h1 id="page-title">Pizzatime</h1>
        <p className="subtitle">rate pizzaparlors inside Padua</p>
      </section>

      <div className="browse-layout">
        <section className="restaurant-section" aria-labelledby="restaurant-heading">
          <div className="section-heading">
            <div>
              <p className="section-kicker">The local list</p>
              <h2 id="restaurant-heading">Restaurants</h2>
            </div>
            <span className="result-count" aria-live="polite">
              {status === 'ready' ? filteredRestaurants.length : '--'} places
            </span>
          </div>

          <div className="search-field">
            <label htmlFor="restaurant-search">Search restaurants</label>
            <div className="search-input-wrap">
              <input
                id="restaurant-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name or address"
                autoComplete="off"
              />
            </div>
          </div>

          {summaryStatus === 'error' && (
            <p className="summary-error" role="status">Average ratings could not be loaded.</p>
          )}

          <div className="restaurant-list" aria-live="polite">
            {status === 'loading' && <p className="list-message">Loading restaurants...</p>}
            {status === 'error' && (
              <p className="list-message">Restaurants could not be loaded. Please try again later.</p>
            )}
            {status === 'ready' && filteredRestaurants.length === 0 && (
              <p className="list-message">No restaurants match your search.</p>
            )}
            {status === 'ready' && filteredRestaurants.map((restaurant) => {
              const summary = ratingSummaries[restaurant.id];
              const ownRating = ratings[restaurant.id];
              const averageLabel = summaryStatus === 'loading'
                ? 'Average rating loading'
                : summaryStatus === 'error'
                  ? 'Average rating unavailable'
                  : summary
                    ? `Average ${Number(summary.average_rating).toFixed(1)} out of 5 from ${summary.rating_count} ratings`
                    : 'No ratings yet';

              return (
                <article className="restaurant-row" key={restaurant.id}>
                  <div className="restaurant-copy">
                    <h3>{restaurant.name}</h3>
                    {restaurant.address && <p>{restaurant.address}</p>}
                  </div>
                  <div className="restaurant-actions">
                    <div className="rating-stat average-rating" aria-label={averageLabel}>
                      <span className="rating-stat-label">Average</span>
                      <span className="rating-stat-value">
                        <Star size={15} fill={summary ? 'currentColor' : 'none'} aria-hidden="true" />
                        {summary ? Number(summary.average_rating).toFixed(1) : summaryStatus === 'loading' ? '...' : '-'}
                        {summary && <small>({summary.rating_count})</small>}
                      </span>
                    </div>
                    <button className="rating-stat own-rating" type="button" onClick={() => openRating(restaurant)} aria-label={`Your rating for ${restaurant.name}: ${ownRating === undefined ? 'not rated' : `${ownRating} out of 5`}. Select to rate.`} title={`Rate ${restaurant.name}`}>
                      <span className="rating-stat-label">Your rating</span>
                      <span className="rating-stat-value">
                        <Star size={15} fill={ownRating === undefined ? 'none' : 'currentColor'} aria-hidden="true" />
                        {ownRating === undefined ? 'Rate' : `${ownRating}/5`}
                      </span>
                    </button>
                    <a
                      className="map-link"
                      href={`https://www.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`View ${restaurant.name} on Google Maps`}
                    >
                      Map <span aria-hidden="true">&#8599;</span>
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="map-section" aria-label="Padua location map">
          <div className="map-heading">
            <span>Our corner of Italy</span>
            <span aria-hidden="true">45.4&deg; N / 11.9&deg; E</span>
          </div>
          <a className="map-image-link" href="/padua-location-map.jpg" target="_blank" rel="noreferrer" title="Open full map">
            <img
              src="/padua-location-map.jpg"
              alt="Map of Italy and nearby countries highlighting the Padua region in red"
              width="800"
              height="1137"
            />
          </a>
          <p className="image-credit">
            Map: <a href="https://www.mapsofindia.com/world-map/italy/padua/location-map.html" target="_blank" rel="noreferrer">Maps of India</a>
          </p>
        </aside>
      </div>
      <footer className="site-footer">
        Restaurant data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>
      </footer>
      {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} />}
      {ratingRestaurant && (
        <RatingDialog
          key={ratingRestaurant.id}
          restaurantName={ratingRestaurant.name}
          currentRating={ratings[ratingRestaurant.id]}
          busy={ratingBusy}
          error={ratingError}
          onClose={() => { if (!ratingBusy) setRatingRestaurant(null); }}
          onSave={(rating) => void saveRating(rating)}
          onRemove={() => void removeRating()}
        />
      )}
    </main>
  );
}

export default App;

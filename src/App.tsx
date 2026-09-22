import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, LogOut, Star, UserRound } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { AdminAddRestaurant } from './AdminAddRestaurant';
import { AdminUsers } from './AdminUsers';
import { AuthDialog } from './AuthDialog';
import { RatingDialog } from './RatingDialog';
import { supabase } from './lib/supabase';

const pizzaSliceSrc = `${import.meta.env.BASE_URL}pizza-slice.png`;
const paduaLocationMapSrc = `${import.meta.env.BASE_URL}padua-location-map.jpg`;
const homePath = import.meta.env.BASE_URL;
const profilePath = `${import.meta.env.BASE_URL}profile`;

function pageFromPath(pathname: string): 'home' | 'profile' {
  return pathname === profilePath || pathname === `${profilePath}/` ? 'profile' : 'home';
}

type Restaurant = {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

type RatingSummary = {
  restaurant_id: string;
  average_rating: string | number;
  rating_count: number;
};

async function fetchRestaurants(): Promise<Restaurant[]> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, address, latitude, longitude')
    .order('name');

  if (error) throw error;
  return data ?? [];
}

async function fetchRatingSummaries(): Promise<Record<string, RatingSummary>> {
  const { data, error } = await supabase.rpc('get_restaurant_rating_averages');
  if (error) throw error;

  const summaries = (data ?? []) as RatingSummary[];
  return Object.fromEntries(summaries.map((item) => [item.restaurant_id, item]));
}

function App() {
  const [page, setPage] = useState<'home' | 'profile'>(() => pageFromPath(window.location.pathname));
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<'user' | 'admin' | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [ratingsStatus, setRatingsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [ratingSummaries, setRatingSummaries] = useState<Record<string, RatingSummary>>({});
  const [summaryStatus, setSummaryStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [authOpen, setAuthOpen] = useState(false);
  const [ratingRestaurant, setRatingRestaurant] = useState<Restaurant | null>(null);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingError, setRatingError] = useState('');
  const activeUserId = useRef<string | null>(null);
  const restaurantRequestId = useRef(0);
  const summaryRequestId = useRef(0);

  function navigate(nextPage: 'home' | 'profile') {
    const path = nextPage === 'profile' ? profilePath : homePath;
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
    setPage(nextPage);
  }

  useEffect(() => {
    const onPopState = () => setPage(pageFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

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

  const refreshRestaurants = useCallback(async () => {
    const requestId = ++restaurantRequestId.current;
    try {
      const data = await fetchRestaurants();
      if (requestId !== restaurantRequestId.current) return;
      setRestaurants(data);
      setStatus('ready');
    } catch {
      if (requestId !== restaurantRequestId.current) return;
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const requestId = ++restaurantRequestId.current;
    void fetchRestaurants().then((data) => {
      if (requestId !== restaurantRequestId.current) return;
      setRestaurants(data);
      setStatus('ready');
    }).catch(() => {
      if (requestId !== restaurantRequestId.current) return;
      setStatus('error');
    });
    return () => { restaurantRequestId.current += 1; };
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      if (nextSession?.user.id !== activeUserId.current) {
        activeUserId.current = nextSession?.user.id ?? null;
        setUsername(null);
        setRole(null);
        setProfileLoaded(false);
        setRatings({});
        setRatingsStatus('loading');
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
        supabase.from('users').select('username, role').eq('user_id', userId).single(),
        supabase.from('userratings').select('restaurant_id, rating').eq('user_id', userId),
      ]);

      if (!active) return;

      setUsername(profileResult.data?.username ?? null);
      setRole(profileResult.data?.role === 'admin' ? 'admin' : 'user');
      setProfileLoaded(true);
      if (!ratingsResult.error) {
        setRatings(Object.fromEntries((ratingsResult.data ?? []).map((item) => [item.restaurant_id, item.rating])));
        setRatingsStatus('ready');
      } else {
        setRatingsStatus('error');
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

  const ratedRestaurants = useMemo(
    () => restaurants.filter((restaurant) => ratings[restaurant.id] !== undefined),
    [restaurants, ratings],
  );
  const ratingValues = Object.values(ratings);
  const ratingCount = ratingValues.length;
  const personalAverage = ratingCount > 0
    ? (ratingValues.reduce((total, rating) => total + rating, 0) / ratingCount).toFixed(1)
    : null;

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
              <button className="account-name" type="button" onClick={() => navigate('profile')} aria-label="Open your profile" aria-current={page === 'profile' ? 'page' : undefined}>
                <UserRound size={16} aria-hidden="true" /><span className="account-username">{username ?? 'Account'}</span>
              </button>
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

      {page === 'profile' ? (
        <section className="profile-page" aria-labelledby="profile-title">
          <button className="profile-back" type="button" onClick={() => navigate('home')}>
            <ArrowLeft size={17} aria-hidden="true" /> Restaurants
          </button>
          <h1 id="profile-title">Your profile</h1>
          {!authReady ? <p>Loading profile...</p> : session ? (
            <>
              <dl className="profile-details">
                <div>
                  <dt>Username</dt>
                  <dd>{username ?? (profileLoaded ? 'Unavailable' : 'Loading...')}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{session.user.email ?? 'Not available'}</dd>
                </div>
              </dl>

              <section className="profile-ratings" aria-labelledby="profile-ratings-title">
                <h2 id="profile-ratings-title">Your ratings</h2>
                <div className="profile-stats">
                  <div>
                    <span className="profile-stat-value">{ratingsStatus === 'ready' ? ratingCount : '--'}</span>
                    <span className="profile-stat-label">Restaurants rated</span>
                  </div>
                  <div>
                    <span className="profile-stat-value">{ratingsStatus === 'ready' ? personalAverage ?? '-' : '--'}</span>
                    <span className="profile-stat-label">Average rating</span>
                  </div>
                </div>

                {ratingsStatus === 'loading' && <p className="list-message">Loading your ratings...</p>}
                {ratingsStatus === 'error' && <p className="list-message">Your ratings could not be loaded.</p>}
                {ratingsStatus === 'ready' && ratingCount === 0 && <p className="list-message">No restaurants rated yet.</p>}
                {ratingsStatus === 'ready' && ratingCount > 0 && status === 'loading' && <p className="list-message">Loading restaurants...</p>}
                {ratingsStatus === 'ready' && ratingCount > 0 && status === 'error' && <p className="list-message">The restaurant list could not be loaded.</p>}
                {ratingsStatus === 'ready' && status === 'ready' && ratedRestaurants.length > 0 && (
                  <ul className="profile-rating-list">
                    {ratedRestaurants.map((restaurant) => (
                      <li key={restaurant.id}>
                        <div className="profile-rating-copy">
                          <strong>{restaurant.name}</strong>
                          {restaurant.address && <span>{restaurant.address}</span>}
                        </div>
                        <button className="profile-rating-button" type="button" onClick={() => openRating(restaurant)} aria-label={`Edit your rating for ${restaurant.name}: ${ratings[restaurant.id]} out of 5`} title="Edit rating">
                          <img className="pizza-slice-icon" src={pizzaSliceSrc} alt="" aria-hidden="true" /> {ratings[restaurant.id]}/5
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {role === 'admin' && (
                <>
                  <AdminAddRestaurant onCreated={() => void refreshRestaurants()} />
                  <AdminUsers currentUserId={session.user.id} onUserDeleted={() => void refreshRatingSummaries()} />
                </>
              )}
            </>
          ) : <button className="account-button" type="button" onClick={() => setAuthOpen(true)}>Sign in</button>}
        </section>
      ) : <>
      <section className="intro" aria-labelledby="page-title">
        <h1 id="page-title">Pizzatime</h1>
        <p className="subtitle">Rate pizzaparlors in the heart of Padua</p>
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
              const mapUrl = restaurant.latitude !== null && restaurant.longitude !== null
                ? `https://www.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurant.name}, ${restaurant.address ?? ''}, Padova, Italy`)}`;
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
                        <img className={`pizza-slice-icon${ownRating === undefined ? ' unrated' : ''}`} src={pizzaSliceSrc} alt="" aria-hidden="true" />
                        {ownRating === undefined ? 'Rate' : `${ownRating}/5`}
                      </span>
                    </button>
                    <a
                      className="map-link"
                      href={mapUrl}
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
            <span aria-hidden="true">45.4&deg; N / 11.9&deg; E</span>
          </div>
          <a className="map-image-link" href={paduaLocationMapSrc} target="_blank" rel="noreferrer" title="Open full map">
            <img
              src={paduaLocationMapSrc}
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
      </>}
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

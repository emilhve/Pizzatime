import { useEffect, useMemo, useState } from 'react';
import { supabase } from './lib/supabase';

type Restaurant = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
};

function App() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

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

  const filteredRestaurants = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return restaurants;

    return restaurants.filter((restaurant) =>
      `${restaurant.name} ${restaurant.address ?? ''}`.toLocaleLowerCase().includes(term),
    );
  }, [query, restaurants]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <span className="topbar-mark" aria-hidden="true" />
        <span>PADOVA, ITALY</span>
        <span className="topbar-edition">A city of pizza</span>
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

          <div className="restaurant-list" aria-live="polite">
            {status === 'loading' && <p className="list-message">Loading restaurants...</p>}
            {status === 'error' && (
              <p className="list-message">Restaurants could not be loaded. Please try again later.</p>
            )}
            {status === 'ready' && filteredRestaurants.length === 0 && (
              <p className="list-message">No restaurants match your search.</p>
            )}
            {status === 'ready' && filteredRestaurants.map((restaurant) => (
              <article className="restaurant-row" key={restaurant.id}>
                <div className="restaurant-copy">
                  <h3>{restaurant.name}</h3>
                  {restaurant.address && <p>{restaurant.address}</p>}
                </div>
                <a
                  className="map-link"
                  href={`https://www.google.com/maps?q=${restaurant.latitude},${restaurant.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`View ${restaurant.name} on Google Maps`}
                >
                  Map <span aria-hidden="true">&#8599;</span>
                </a>
              </article>
            ))}
          </div>
        </section>

        <aside className="map-section" aria-label="Padua location map">
          <div className="map-heading">
            <span>Our corner of Italy</span>
            <span aria-hidden="true">45.4&deg; N / 11.9&deg; E</span>
          </div>
          <img
            src="/padua-location-map.jpg"
            alt="Map of Italy and nearby countries highlighting the Padua region in red"
            width="800"
            height="1137"
          />
          <p className="image-credit">
            Map: <a href="https://www.mapsofindia.com/world-map/italy/padua/location-map.html" target="_blank" rel="noreferrer">Maps of India</a>
          </p>
        </aside>
      </div>
      <footer className="site-footer">
        Restaurant data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>
      </footer>
    </main>
  );
}

export default App;

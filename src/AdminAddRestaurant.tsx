import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import searchArea from '../config/padova-search-area.json';
import { supabase } from './lib/supabase';

type AdminAddRestaurantProps = {
  onCreated: () => void;
};

const coordinatePattern = /^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*$/;

export function AdminAddRestaurant({ onCreated }: AdminAddRestaurantProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function addRestaurant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    if (!trimmedName || !trimmedAddress || !coordinates.trim() || busy) return;

    const match = coordinates.match(coordinatePattern);
    if (!match) {
      setError('Enter coordinates as latitude, longitude.');
      setMessage('');
      return;
    }

    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    const { boundsApprox } = searchArea;
    if (latitude < boundsApprox.south || latitude > boundsApprox.north || longitude < boundsApprox.west || longitude > boundsApprox.east) {
      setError('The coordinates must be inside the Padua area.');
      setMessage('');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    const { error: insertError } = await supabase
      .from('restaurants')
      .insert({ name: trimmedName, address: trimmedAddress, latitude, longitude });

    setBusy(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    onCreated();
    setName('');
    setAddress('');
    setCoordinates('');
    setMessage(`${trimmedName} was added.`);
  }

  return (
    <section className="admin-add-place" aria-labelledby="admin-add-place-title">
      <h2 id="admin-add-place-title">Add a place</h2>
      <form className="admin-place-form" onSubmit={(event) => void addRestaurant(event)}>
        <label htmlFor="place-name">Name</label>
        <input id="place-name" value={name} onChange={(event) => setName(event.target.value)} required disabled={busy} />
        <label htmlFor="place-address">Address</label>
        <input id="place-address" value={address} onChange={(event) => setAddress(event.target.value)} required disabled={busy} />
        <label htmlFor="place-coordinates">Coordinates</label>
        <input id="place-coordinates" value={coordinates} onChange={(event) => setCoordinates(event.target.value)} placeholder="45.39649993775894, 11.880741228940213" required disabled={busy} autoComplete="off" />
        {error && <p className="form-message" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        <button className="primary-button" type="submit" disabled={busy || !name.trim() || !address.trim() || !coordinates.trim()}>
          <Plus size={17} aria-hidden="true" /> {busy ? 'Adding...' : 'Add place'}
        </button>
      </form>
    </section>
  );
}

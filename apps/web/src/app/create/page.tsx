'use client';

import { queryKeys } from '@playaround/api-client';
import { splitShares } from '@playaround/contracts';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Chrome } from '@/components/chrome';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { errorMessage, shareLabel } from '@/lib/format';

export default function CreatePage() {
  const router = useRouter();
  const token = useAuth((s) => s.accessToken);
  const sports = useQuery({ queryKey: queryKeys.sports, queryFn: () => api.catalog.sports() });
  const venues = useQuery({ queryKey: queryKeys.venues(), queryFn: () => api.catalog.venues(), enabled: Boolean(token) });
  const [type, setType] = useState<'EXISTING_BOOKING' | 'LOOKING_FOR_PLAYERS'>('EXISTING_BOOKING');
  const [sportId, setSportId] = useState<number | null>(null);
  const [venueId, setVenueId] = useState('');
  const [area, setArea] = useState('Dubai Marina');
  const [capacity, setCapacity] = useState(4);
  const sport = (sports.data?.data ?? []).find((item) => item.id === sportId);
  const [costAed, setCostAed] = useState(100);
  const [hours, setHours] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const fils = Number.isFinite(costAed) ? Math.round(costAed * 100) : 0;
  const preview = useMemo(() => {
    if (fils <= 0 || !Number.isInteger(capacity) || capacity < 1) return [];
    return splitShares(fils, capacity);
  }, [fils, capacity]);

  return (
    <Chrome>
      <form
        className="glass mx-auto max-w-xl rounded-xl p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!token) {
            router.push('/login');
            return;
          }
          if (!sportId) {
            setError('Pick a sport.');
            return;
          }
          if (!Number.isInteger(capacity) || capacity < 1) {
            setError('Capacity must be a whole number of at least 1.');
            return;
          }
          if (sport && (capacity < sport.minPlayers || capacity > sport.maxPlayers)) {
            setError(`Capacity for ${sport.name} must be between ${sport.minPlayers} and ${sport.maxPlayers}.`);
            return;
          }
          if (type === 'EXISTING_BOOKING' && !venueId && !venues.data?.data[0]?.id) {
            setError('Select a venue.');
            return;
          }
          if (!Number.isFinite(hours) || hours < 3) {
            setError('Start time must be at least 3 hours from now.');
            return;
          }
          const startsAt = new Date(Date.now() + hours * 60 * 60 * 1000);
          const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
          const run =
            type === 'EXISTING_BOOKING'
              ? api.sessions.create({
                  type,
                  sportId,
                  venue: { venueId: venueId || venues.data?.data[0]?.id || '' },
                  startsAt: startsAt.toISOString(),
                  endsAt: endsAt.toISOString(),
                  capacity,
                  organiserIsPlaying: true,
                  totalCostFils: fils,
                })
              : api.sessions.create({
                  type,
                  sportId,
                  preferredArea: { label: area, latitude: 25.0772, longitude: 55.139, radiusKm: 3 },
                  startsAt: startsAt.toISOString(),
                  endsAt: endsAt.toISOString(),
                  capacity,
                  organiserIsPlaying: true,
                  estimatedTotalCostFils: fils,
                });
          void run.then((created) => router.push(`/sessions/${created.data.id}`)).catch((err) => setError(errorMessage(err)));
        }}
      >
        <h1 className="font-display text-3xl font-bold">Create a session</h1>
        {error ? <p className="mt-3 text-danger">{error}</p> : null}
        <div className="mt-4 flex gap-2">
          <Button type="button" variant={type === 'EXISTING_BOOKING' ? 'primary' : 'glass'} onClick={() => setType('EXISTING_BOOKING')}>
            I have a booking
          </Button>
          <Button type="button" variant={type === 'LOOKING_FOR_PLAYERS' ? 'primary' : 'glass'} onClick={() => setType('LOOKING_FOR_PLAYERS')}>
            Looking for players
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(sports.data?.data ?? []).map((item) => (
            <button
              type="button"
              key={item.id}
              className={`rounded-full px-3 py-1 ${sportId === item.id ? 'bg-primary text-primary-text' : 'bg-surface'}`}
              onClick={() => {
                setSportId(item.id);
                setCapacity(item.defaultPlayers);
              }}
            >
              {item.name}
            </button>
          ))}
        </div>
        {type === 'EXISTING_BOOKING' ? (
          <select className="mt-4 h-11 w-full rounded-lg border px-3" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
            <option value="">Select venue</option>
            {(venues.data?.data ?? []).map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        ) : (
          <input className="mt-4 h-11 w-full rounded-lg border px-3" value={area} onChange={(e) => setArea(e.target.value)} />
        )}
        <label className="mt-4 block text-sm">Hours from now</label>
        <input
          type="number"
          min={1}
          className="h-11 w-full rounded-lg border px-3"
          value={Number.isFinite(hours) ? hours : ''}
          onChange={(e) => setHours(e.target.value === '' ? Number.NaN : Number(e.target.value))}
        />
        <label className="mt-3 block text-sm">
          Capacity{sport ? ` (${sport.minPlayers}–${sport.maxPlayers})` : ''}
        </label>
        <input
          type="number"
          min={sport?.minPlayers ?? 1}
          max={sport?.maxPlayers}
          className="h-11 w-full rounded-lg border px-3"
          value={Number.isFinite(capacity) ? capacity : ''}
          onChange={(e) => setCapacity(e.target.value === '' ? Number.NaN : Number(e.target.value))}
        />
        <label className="mt-3 block text-sm">Total cost (AED)</label>
        <input
          type="number"
          min={0}
          className="h-11 w-full rounded-lg border px-3"
          value={Number.isFinite(costAed) ? costAed : ''}
          onChange={(e) => setCostAed(e.target.value === '' ? Number.NaN : Number(e.target.value))}
        />
        <div className="mt-4 rounded-lg bg-surface p-3 text-sm">
          <p className="font-semibold">Live split</p>
          {preview.length ? (
            preview.map((amount, i) => (
              <p key={i}>
                Player {i + 1}: {shareLabel(amount)}
              </p>
            ))
          ) : (
            <p>{fils <= 0 ? 'Free session' : 'Enter a whole-number capacity of at least 1.'}</p>
          )}
        </div>
        <Button className="mt-5 w-full" type="submit">
          Publish
        </Button>
      </form>
    </Chrome>
  );
}

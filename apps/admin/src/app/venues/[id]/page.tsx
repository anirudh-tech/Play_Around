'use client';

import { queryKeys } from '@playaround/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { asList } from '@/components/data-table';
import { ReasonForm } from '@/components/reason-form';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';
import { inputClass } from '@/lib/format';

type Venue = {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  isVerified: boolean;
  contactPhone: string | null;
  contactEmail: string | null;
  bookingChannel: string | null;
  staffNotes: string | null;
};

export default function VenueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const client = useQueryClient();
  const venue = useQuery({ queryKey: queryKeys.admin.venue(id), queryFn: () => api.admin.venue(id) });
  const venues = useQuery({ queryKey: queryKeys.admin.venues(), queryFn: () => api.admin.venues() });
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [intoId, setIntoId] = useState('');
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.admin.venue(id) });
  const patch = useMutation({
    mutationFn: (reason: string) =>
      api.admin.patchVenue(id, {
        reason,
        contactPhone: phone || null,
        staffNotes: notes || null,
      }),
    onSuccess: invalidate,
  });
  const verify = useMutation({
    mutationFn: (reason: string) => api.admin.patchVenue(id, { reason, isVerified: true }),
    onSuccess: invalidate,
  });
  const merge = useMutation({
    mutationFn: (reason: string) => api.admin.mergeVenue(id, { intoVenueId: intoId, reason }),
    onSuccess: invalidate,
  });
  const data = venue.data?.data as Venue | undefined;
  const others = asList<Venue>(venues.data?.data).filter((row) => row.id !== id);

  return (
    <Shell>
      {venue.isPending ? <p>Loading…</p> : null}
      {data ? (
        <>
          <h1 className="text-xl font-bold">{data.name}</h1>
          <p className="text-sm text-text-muted">
            {data.addressLine}, {data.city} · {data.isVerified ? 'verified' : 'unverified'}
          </p>
          <p className="mt-2 text-sm">
            Contact {data.contactPhone ?? '—'} / {data.contactEmail ?? '—'} · Channel {data.bookingChannel ?? '—'}
          </p>
          <p className="text-sm whitespace-pre-wrap">{data.staffNotes ?? ''}</p>
          <div className="mt-6 max-w-md space-y-4">
            <ReasonForm
              actionLabel="Save staff contact"
              extra={
                <>
                  <input className={inputClass} placeholder="Staff phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  <textarea className={`${inputClass} h-20`} placeholder="Staff notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </>
              }
              onSubmit={(reason) => patch.mutateAsync(reason)}
            />
            {!data.isVerified ? <ReasonForm actionLabel="Verify venue" onSubmit={(reason) => verify.mutateAsync(reason)} /> : null}
            <ReasonForm
              actionLabel="Merge into selected venue"
              extra={
                <select className={inputClass} value={intoId} onChange={(e) => setIntoId(e.target.value)}>
                  <option value="">Merge into…</option>
                  {others.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              }
              onSubmit={(reason) => merge.mutateAsync(reason)}
            />
          </div>
        </>
      ) : null}
    </Shell>
  );
}

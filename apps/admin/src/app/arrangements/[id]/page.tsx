'use client';

import { queryKeys } from '@playaround/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { asList } from '@/components/data-table';
import { ReasonForm } from '@/components/reason-form';
import { Shell } from '@/components/shell';
import { api } from '@/lib/api';
import { inputClass, when } from '@/lib/format';

type Staff = { id: string; email: string; profile?: { displayName: string } | null };
type Option = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  totalCostFils: number;
  venue?: { name: string };
};
type Arrangement = {
  id: string;
  status: string;
  staffNotes: string | null;
  session?: { id: string; title: string; startsAt: string };
  options?: Option[];
};

export default function ArrangementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const client = useQueryClient();
  const row = useQuery({ queryKey: queryKeys.admin.arrangement(id), queryFn: () => api.admin.arrangement(id) });
  const staff = useQuery({ queryKey: queryKeys.admin.staff, queryFn: () => api.admin.staff() });
  const venues = useQuery({ queryKey: queryKeys.admin.venues(), queryFn: () => api.admin.venues() });
  const [assigneeId, setAssigneeId] = useState('');
  const [venueId, setVenueId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [cost, setCost] = useState('10000');
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.admin.arrangement(id) });
  const assign = useMutation({
    mutationFn: (reason: string) => api.admin.assignArrangement(id, { assigneeId, reason }),
    onSuccess: invalidate,
  });
  const option = useMutation({
    mutationFn: (reason: string) =>
      api.admin.addArrangementOption(id, {
        reason,
        venueId,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        totalCostFils: Number(cost),
      }),
    onSuccess: invalidate,
  });
  const book = useMutation({
    mutationFn: (input: { optionId: string; reason: string; sessionId: string }) =>
      api.admin.recordBooking(input.sessionId, { venueOptionId: input.optionId, reason: input.reason }),
    onSuccess: invalidate,
  });
  const data = row.data?.data as Arrangement | undefined;
  const people = asList<Staff>(staff.data?.data);
  const venueRows = asList<{ id: string; name: string }>(venues.data?.data);

  return (
    <Shell>
      {row.isPending ? <p>Loading…</p> : null}
      {data ? (
        <>
          <h1 className="text-xl font-bold">{data.session?.title ?? 'Arrangement'}</h1>
          <p className="text-sm text-text-muted">
            {data.status} · session {when(data.session?.startsAt)}
          </p>
          <p className="mt-2 text-sm whitespace-pre-wrap">{data.staffNotes}</p>
          <div className="mt-6 max-w-lg space-y-4">
            <ReasonForm
              actionLabel="Assign"
              extra={
                <select className={inputClass} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  <option value="">Staff member</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.profile?.displayName ?? person.email}
                    </option>
                  ))}
                </select>
              }
              onSubmit={(reason) => assign.mutateAsync(reason)}
            />
            <ReasonForm
              actionLabel="Propose option"
              extra={
                <>
                  <select className={inputClass} value={venueId} onChange={(e) => setVenueId(e.target.value)}>
                    <option value="">Venue</option>
                    {venueRows.map((venue) => (
                      <option key={venue.id} value={venue.id}>
                        {venue.name}
                      </option>
                    ))}
                  </select>
                  <input className={inputClass} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                  <input className={inputClass} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                  <input className={inputClass} value={cost} onChange={(e) => setCost(e.target.value)} />
                </>
              }
              onSubmit={(reason) => option.mutateAsync(reason)}
            />
          </div>
          <h2 className="mt-6 text-sm font-semibold">Options</h2>
          <ul className="space-y-3 text-sm">
            {(data.options ?? []).map((item) => (
              <li key={item.id} className="rounded-md border border-border p-3">
                <p>
                  {item.venue?.name} · {item.status} · {when(item.startsAt)} · {item.totalCostFils} fils
                </p>
                {data.session && item.status === 'PROPOSED' ? (
                  <ReasonForm
                    actionLabel="Record booking on behalf of organiser"
                    onSubmit={(reason) => book.mutateAsync({ optionId: item.id, reason, sessionId: data.session!.id })}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Shell>
  );
}

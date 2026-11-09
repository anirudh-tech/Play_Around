import http from 'k6/http';
import { check, sleep } from 'k6';

const API = __ENV.API_URL ?? 'http://localhost:4000';

export const options = {
  scenarios: {
    join_burst: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: Number(__ENV.VUS ?? 10) },
        { duration: __ENV.DURATION ?? '20s', target: Number(__ENV.VUS ?? 10) },
        { duration: '5s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.2'],
  },
};

export default function joinBurst() {
  const email = `k6-${__VU}-${__ITER}@load.playaround.local`;
  const register = http.post(
    `${API}/api/v1/auth/register`,
    JSON.stringify({ email, password: 'correcthorsebattery', displayName: 'Load' }),
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Client': 'ios',
        'X-App-Version': '0.0.0',
      },
    },
  );
  check(register, { 'register 201 or 409': (r) => r.status === 201 || r.status === 409 });
  sleep(0.2);
}

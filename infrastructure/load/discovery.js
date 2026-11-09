import http from 'k6/http';
import { check, sleep } from 'k6';

const API = __ENV.API_URL ?? 'http://localhost:4000';

export const options = {
  scenarios: {
    nearby_burst: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RATE ?? 20),
      timeUnit: '1s',
      duration: __ENV.DURATION ?? '30s',
      preAllocatedVUs: 20,
      maxVUs: 80,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<800'],
  },
};

export default function nearbyBurst() {
  const res = http.get(`${API}/api/v1/sessions/nearby?lat=25.0772&lng=55.139&autoExpand=true`, {
    headers: { Accept: 'application/json', 'X-Client': 'web', 'X-App-Version': '0.0.0' },
  });
  check(res, { 'nearby is 200 or 401': (r) => r.status === 200 || r.status === 401 });
  sleep(0.05);
}

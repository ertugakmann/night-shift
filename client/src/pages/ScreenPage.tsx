import { Navigate, useLocation, useParams } from 'react-router';
import { parseScreenId } from '@night-shift/shared';
import { STYLED, ScreenPanel } from '../components/ScreenPanel';

/** One wall screen, full size. */
export function ScreenPage() {
  const id = parseScreenId(useParams().id);
  const { search } = useLocation();
  if (id === null) return <Navigate to={`/${search}`} replace />;
  return (
    <main className={STYLED.has(id) ? "h-full w-full" : "h-full w-full p-2"}>
      <ScreenPanel id={id} />
    </main>
  );
}

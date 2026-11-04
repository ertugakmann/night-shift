import { Link } from 'react-router';
import { SCREENS, type ScreenId } from '@night-shift/shared';

const IDS: ScreenId[] = [1, 2, 3, 4, 5];

/** Index of all pages. The presenter key stays in this tab's sessionStorage, so links don't carry it. */
export function HomePage() {
  return (
    <main className="flex h-full w-full flex-col items-center justify-center gap-6 p-4">
      <h1 className="text-4xl font-bold tracking-widest text-flash">NIGHT SHIFT</h1>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/wall" className="rounded-xl bg-flash px-6 py-3 text-xl font-semibold text-night-950">
          Security Office (/wall)
        </Link>
        <Link to="/preview" className="rounded-xl bg-safe px-6 py-3 text-xl font-semibold text-night-950">
          Screen switcher (/preview)
        </Link>
      </div>
      <nav className="flex flex-wrap justify-center gap-3">
        {IDS.map((id) => (
          <Link key={id} to={`/screen/${id}`} className="rounded-lg bg-night-800 px-4 py-2 text-base hover:bg-night-800/70">
            {id}. {SCREENS[id].name}
          </Link>
        ))}
      </nav>
    </main>
  );
}

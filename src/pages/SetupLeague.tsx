import { useLeague } from '../state';
import { defaultLeague, hasLocalLeague, loadLeague } from '../lib/storage';

/** Shown when connected to Firebase but no league has been published yet. */
export function SetupLeague() {
  const { canEdit, replace } = useLeague();

  if (!canEdit)
    return (
      <div className="card empty">
        <p>The league hasn’t been set up yet. Check back soon.</p>
      </div>
    );

  const local = hasLocalLeague();
  return (
    <div className="card empty">
      <h2>Set up the league</h2>
      <p>There’s no league online yet. Once you start one, everyone with the link can see it.</p>
      <div className="form-row center">
        {local && (
          <button className="btn primary" onClick={() => replace(loadLeague())}>
            Publish the league saved in this browser
          </button>
        )}
        <button
          className={`btn${local ? '' : ' primary'}`}
          onClick={() => {
            if (!local || window.confirm('Start an empty league instead of publishing the one saved in this browser?'))
              replace(defaultLeague());
          }}
        >
          Start a new league
        </button>
      </div>
    </div>
  );
}

import type { StageChangeNotice } from '../hooks/useStageChangeNotice';

interface StageChangeBannerProps {
  notice: StageChangeNotice | null;
}

// The live region stays mounted even when empty: screen readers only announce
// content injected into a region that already existed.
export default function StageChangeBanner({ notice }: StageChangeBannerProps) {
  return (
    <div className="stage-banner-region" aria-live="polite">
      {notice && (
        <div key={`${notice.songIndex}:${notice.stage}`} className={`stage-banner stage-banner-${notice.kind}`}>
          {notice.kind === 'song' ? (
            <>
              <strong>Nouvelle musique</strong>
              <span>
                {notice.songIndex}/{notice.songCount}
              </span>
            </>
          ) : (
            <>
              <strong>Nouvelle étape</strong>
              <span>
                {notice.stage}/{notice.maxStage} · {notice.durationSeconds} s d'écoute
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

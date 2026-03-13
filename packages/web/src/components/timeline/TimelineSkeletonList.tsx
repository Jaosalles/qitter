const SKELETON_IDS = ["alpha", "beta", "gamma", "delta", "epsilon"] as const;

interface TimelineSkeletonListProps {
  count?: number;
}

export function TimelineSkeletonList(props: TimelineSkeletonListProps) {
  const count = props.count ?? 3;
  const skeletonIds = SKELETON_IDS.slice(0, count);

  return (
    <output aria-label="Loading timeline posts" className="timeline">
      {skeletonIds.map((skeletonId) => (
        <article
          className="card timelineSkeletonCard"
          key={`timeline-skeleton-${skeletonId}`}
        >
          <div className="cardHeader">
            <span className="skeletonLine skeletonLineShort" />
            <span className="skeletonLine skeletonLineTiny" />
          </div>
          <div className="timelineSkeletonBody">
            <span className="skeletonLine skeletonLineLong" />
            <span className="skeletonLine skeletonLineMedium" />
          </div>
          <footer>
            <span className="skeletonLine skeletonLineTiny" />
          </footer>
        </article>
      ))}
    </output>
  );
}

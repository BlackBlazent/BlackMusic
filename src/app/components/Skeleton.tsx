import "./Skeleton.css";

export function Skeleton({ width, height, radius = "6px" }: { width: string; height: string; radius?: string }) {
  return <span className="skeleton" style={{ width, height, borderRadius: radius }} />;
}

export function SkeletonRows({ count, height = "18px" }: { count: number; height?: string }) {
  return (
    <div className="skeleton-rows">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-rows__row">
          <Skeleton width="32px" height="32px" radius="6px" />
          <Skeleton width="30%" height={height} />
          <Skeleton width="20%" height={height} />
          <Skeleton width="15%" height={height} />
        </div>
      ))}
    </div>
  );
}

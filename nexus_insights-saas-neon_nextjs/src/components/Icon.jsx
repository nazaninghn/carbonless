export const Icon = ({ className, children, variant, contentKey, ... props }) => {
  return (
    <svg viewBox={props.viewBox || "0 0 24 24"} fill={props.fill || "currentColor"} className={className} {...props}>{children}</svg>
  );
};

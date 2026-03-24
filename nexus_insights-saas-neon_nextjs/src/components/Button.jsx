export const Button = ({ className, children, variant, contentKey, ... props }) => {
  return (
    <button className={className} {...props}>{children}</button>
  );
};

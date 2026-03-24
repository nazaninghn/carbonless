import NextLink from 'next/link';

export const Link = ({ className, children, variant, contentKey, ... props }) => {
  const getHref = (href) => {
    if (!href) return '#';
    if (href.endsWith('.html')) {
      const path = href === 'index.html' ? '/' : href.slice(0, -5);
      return path.startsWith('/') ? path : '/' + path;
    }
    return href;
  };

  return (
    <>
          {props.href && (props.href.startsWith('http') || props.href.startsWith('mailto:') || props.href.startsWith('#')) ? (
            <a className={className} {...props}>{children}</a>
          ) : (
            (() => {
              const { href, ...rest } = props;
              return <NextLink className={className} href={getHref(href)} {...rest}>{children}</NextLink>;
            })()
          )}
        </>
  );
};

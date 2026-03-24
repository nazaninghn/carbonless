import NextImage from 'next/image';

export const Image = ({ className, children, variant, contentKey, ... props }) => {
  return (
    <NextImage
          src={props.src || ''}
          alt={props.alt || ''}
          width={props.width || 100}
          height={props.height || 100}
          className={className}
          {... props}
        />
  );
};

'use client';

export const Input = ({ className = '', ...props }) => {
  return (
    <input className={className} {...props} />
  );
};

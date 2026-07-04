export default function Card({ className = "", children, ...props }) {
  return (
    <div
      className={`bg-white border border-[#EEF2F6] rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,.04)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

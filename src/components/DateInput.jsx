export default function DateInput({ value, onChange, ...props }) {
  return (
    <input
      className="input"
      type="date"
      value={(value || '').slice(0, 10)}
      onChange={(event) => onChange(event.target.value)}
      {...props}
    />
  );
}

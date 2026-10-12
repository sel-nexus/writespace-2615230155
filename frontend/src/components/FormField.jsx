/** Bind required inputs to visible labels and field-level feedback. */
import PropTypes from 'prop-types';

/** Render a controlled text field with associated errors.
 * Args: id, label, value, onChange, type, autoComplete, error, required: field contract.
 * Returns: {JSX.Element} Accessible label/input/error group.
 */
export function FormField({ id, label, value, onChange, type = 'text', autoComplete, error, required = true }) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required={required}
        aria-required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}
    </div>
  );
}
FormField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  type: PropTypes.string,
  autoComplete: PropTypes.string,
  error: PropTypes.string,
  required: PropTypes.bool,
};

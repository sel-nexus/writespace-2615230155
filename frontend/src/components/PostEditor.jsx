/** Share controlled plain-text editing, inline validation and no-write cancellation. */
import { useState } from "react";
import PropTypes from "prop-types";
import { FormField } from "./FormField.jsx";
import { validatePost } from "../lib/validation.js";

/** Keep entered text visible until the parent reports successful persistence.
 * Args: initialFields, submitLabel, onSave, onCancel: prefill and synchronous result callbacks.
 * Returns: {JSX.Element} Accessible editor with field errors and content counter.
 * Notes: Cancel calls only the navigation callback, never onSave.
 */
export function PostEditor({
  initialFields = { title: "", content: "" },
  submitLabel = "Publish Post",
  onSave,
  onCancel,
}) {
  const [fields, setFields] = useState(() => ({
    title: initialFields.title,
    content: initialFields.content,
  }));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");

  /** Validate both fields, then display any typed save failure without clearing text. */
  function submit(event) {
    event.preventDefault();
    const nextErrors = validatePost(fields);
    setErrors(nextErrors);
    setMessage("");
    if (Object.keys(nextErrors).length) return;
    const result = onSave(fields);
    if (!result.ok) {
      if (result.error.field)
        setErrors({ [result.error.field]: result.error.message });
      else setMessage(result.error.message);
    }
  }

  return (
    <form className="post-editor" noValidate onSubmit={submit}>
      <FormField
        id="title"
        label="Title"
        value={fields.title}
        error={errors.title}
        onChange={(event) =>
          setFields({ ...fields, title: event.target.value })
        }
      />
      <div className="form-field">
        <label htmlFor="content">Content</label>
        <textarea
          id="content"
          name="content"
          value={fields.content}
          required
          aria-required="true"
          aria-invalid={Boolean(errors.content)}
          aria-describedby={
            errors.content ? "content-error content-counter" : "content-counter"
          }
          onChange={(event) =>
            setFields({ ...fields, content: event.target.value })
          }
        />
        {errors.content && (
          <p id="content-error" className="field-error" role="alert">
            {errors.content}
          </p>
        )}
        <p id="content-counter" className="character-counter">
          {fields.content.length} characters
        </p>
      </div>
      {message && (
        <p className="error-banner" role="alert">
          {message}
        </p>
      )}
      <div className="editor-actions">
        <button className="button primary" type="submit">
          {submitLabel}
        </button>
        <button className="button secondary" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

PostEditor.propTypes = {
  initialFields: PropTypes.shape({
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
  }),
  submitLabel: PropTypes.string,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

// Presentation-only mappings for field types. Business rules (reserved names,
// length types, dropdown sources, limits) come from the API: GET /v1/meta/builder.

// Icon per type key, used in the "Add field" menu.
export const TYPE_ICONS = {
  string: 'pi pi-minus',
  text: 'pi pi-align-left',
  number: 'pi pi-hashtag',
  integer: 'pi pi-hashtag',
  date: 'pi pi-calendar',
  time: 'pi pi-clock',
  boolean: 'pi pi-check-square',
  dropdown: 'pi pi-list',
  email: 'pi pi-envelope',
  phone: 'pi pi-phone'
}
export const DEFAULT_TYPE_ICON = 'pi pi-circle'

// Which input the preview draws for a type key...
export const INPUT_KIND_BY_TYPE = {
  string: 'text', varchar: 'text', email: 'email', phone: 'phone', text: 'textarea', textarea: 'textarea',
  number: 'number', decimal: 'number', integer: 'number', bigint: 'number',
  date: 'date', time: 'time', boolean: 'boolean', dropdown: 'dropdown'
}

// ...or, for unknown keys, for the data type's input_field_type.
export const INPUT_KIND_BY_INPUT_TYPE = {
  text: 'text', textarea: 'textarea', number: 'number', date: 'date', time: 'time',
  checkbox: 'boolean', dropdown: 'dropdown', email: 'email', phone: 'phone'
}

export const WHOLE_NUMBER_TYPES = ['integer', 'bigint']

export const DROPDOWN_TYPE = 'dropdown'
export const NEW_DROPDOWN_OPTIONS = ['Option 1', 'Option 2']

// Client-side format checks used by the preview.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PHONE_PATTERN = /^\+?[0-9][0-9 -]{6,18}$/

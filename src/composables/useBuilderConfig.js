// Builder rules (from /v1/meta/builder) and field types (from /v1/getDataTypes),
// loaded once and shared by every component that needs them.
import { computed, ref } from 'vue'
import { metaApi } from '@/services/api'
import { previewColumnName } from '@/utils/format'

const builder = ref(null)
const dataTypes = ref([])
let loading = null

async function load() {
  if (builder.value) return
  if (!loading) {
    loading = Promise.all([metaApi.builder(), metaApi.dataTypes()])
      .then(([meta, types]) => {
        builder.value = meta.builder
        dataTypes.value = (types.data_types || types.widgets || []).map((t) => ({
          ...t,
          type_key: String(t.type_key).toLowerCase()
        }))
      })
      .finally(() => {
        loading = null
      })
  }
  return loading
}

export function useBuilderConfig() {
  const limits = computed(() => builder.value?.limits || {})
  const staticSource = computed(() => builder.value?.static_source)
  const dropdownSources = computed(() => builder.value?.dropdown_sources || [])

  const inputTypes = computed(() => Object.fromEntries(dataTypes.value.map((t) => [t.type_key, t.input_field_type])))

  function isLengthType(typeKey) {
    return (builder.value?.length_types || []).includes(typeKey)
  }

  function isReserved(columnName) {
    return (builder.value?.reserved_columns || []).includes(columnName)
  }

  function typeName(typeKey) {
    return dataTypes.value.find((t) => t.type_key === typeKey)?.display_name || typeKey
  }

  function columnPreview(label) {
    return previewColumnName(label, builder.value?.max_identifier_length)
  }

  function defaultLength(typeKey) {
    return typeKey === 'phone' ? limits.value.default_phone_length : limits.value.default_text_length
  }

  return {
    builder, dataTypes, limits, staticSource, dropdownSources, inputTypes,
    load, isLengthType, isReserved, typeName, columnPreview, defaultLength
  }
}

/**
 * Shared utility to flatten matrix-formatted bulk_upload_data into a flat list of items.
 * Matrix format has nested sections > rows > values.
 */

export function flattenBulkUploadData(bulkData: any[]): any[] {
  if (!bulkData || bulkData.length === 0) return [];

  // Check if this is matrix format (sections with rows and values)
  // Matrix format sections have 'section_name' and 'rows'
  const isMatrixFormat = bulkData[0]?.section_name !== undefined && bulkData[0]?.rows !== undefined;

  if (!isMatrixFormat) {
    // Flat format - normalize field names for display
    // Agent parser uses 'parsed_value', template parser uses 'data_value'
    return bulkData
      .filter((item) => item.type !== "metadata") // Skip metadata entries
      .map((item) => ({
        ...item,
        // Normalize to data_value for display
        data_value: item.data_value ?? item.parsed_value,
        // Use display name if available, otherwise format param_name
        display_name:
          item.display_name ||
          item.param_display_name ||
          item.param_name?.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
      }));
  }

  // Flatten matrix format: sections > rows > values
  const flatItems: any[] = [];

  for (const section of bulkData) {
    const sectionName = section.section_name || "Unknown Section";

    for (const row of section.rows || []) {
      const rowDisplayName =
        row.display_name ||
        row.param_name?.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());

      for (const value of row.values || []) {
        flatItems.push({
          // Core display fields
          display_name: rowDisplayName,
          param_name: row.param_name,
          column: value.column, // The column name like "AFBC-1", "VSF"

          // Value fields
          data_value: value.value,
          cell_ref: value.cell_ref,
          moving_average: value.moving_average,
          lookback_months: value.lookback_months,
          param_id: value.param_id,

          // Unit and category info
          param_unit: row.unit,
          data_type: row.category || "input",
          is_calculated: row.is_calculated,
          data_source: row.data_source,

          // Section context
          section_name: sectionName,

          // Original text for reference (cell_ref: value format)
          original_text: value.cell_ref ? `${value.cell_ref}: ${value.value}` : undefined,
        });
      }
    }
  }

  return flatItems;
}

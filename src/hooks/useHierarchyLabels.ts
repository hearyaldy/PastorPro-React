import { useMemo } from 'react';
import { useMission } from '../contexts/MissionContext';
import { createHierarchyLabels } from '../lib/hierarchyLabels';

export function useHierarchyLabels() {
  const { unions, missions, regions, districts, churches } = useMission();
  return useMemo(() => createHierarchyLabels({ unions, missions, regions, districts, churches }), [unions, missions, regions, districts, churches]);
}

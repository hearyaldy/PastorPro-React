import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from './AuthContext';
import type {
  Church,
  Department,
  District,
  GlobalEvent,
  Mission,
  MissionResource,
  Region,
  StaffMember,
  Union,
} from '../types';

interface MissionContextValue {
  unions: Union[];
  missions: Mission[];
  regions: Region[];
  districts: District[];
  churches: Church[];
  departments: Department[];
  staff: StaffMember[];
  globalEvents: GlobalEvent[];
  resources: MissionResource[];
  loadingHierarchy: boolean;
  logAdminActivity: (
    action: string,
    targetType: string,
    summary: string,
    targetId?: string,
  ) => Promise<void>;
}

const MissionContext = createContext<MissionContextValue | undefined>(undefined);

export function MissionProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser } = useAuth();
  const [unions, setUnions] = useState<Union[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [churches, setChurches] = useState<Church[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [globalEvents, setGlobalEvents] = useState<GlobalEvent[]>([]);
  const [resources, setResources] = useState<MissionResource[]>([]);
  const [loadingHierarchy, setLoadingHierarchy] = useState(true);

  useEffect(() => {
    if (!firebaseUser) {
      setUnions([]);
      setMissions([]);
      setRegions([]);
      setDistricts([]);
      setChurches([]);
      setDepartments([]);
      setStaff([]);
      setGlobalEvents([]);
      setResources([]);
      setLoadingHierarchy(false);
      return;
    }

    setLoadingHierarchy(true);

    const safeListenError = (col: string, err: unknown, isMissionLoad = false) => {
      console.warn(`MissionContext listener warning (${col}):`, err);
      if (isMissionLoad) setLoadingHierarchy(false);
    };

    const unsubs = [
      onSnapshot(
        query(collection(db, 'unions'), orderBy('name', 'asc')),
        (snap) => {
          setUnions(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Union, 'id'>) })),
          );
        },
        (err) => safeListenError('unions', err),
      ),
      onSnapshot(
        query(collection(db, 'missions'), orderBy('name', 'asc')),
        (snap) => {
          setMissions(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Mission, 'id'>) })),
          );
          setLoadingHierarchy(false);
        },
        (err) => safeListenError('missions', err, true),
      ),
      onSnapshot(
        query(collection(db, 'regions'), orderBy('name', 'asc')),
        (snap) => {
          setRegions(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Region, 'id'>) })),
          );
        },
        (err) => safeListenError('regions', err),
      ),
      onSnapshot(
        query(collection(db, 'districts'), orderBy('name', 'asc')),
        (snap) => {
          setDistricts(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<District, 'id'>) })),
          );
        },
        (err) => safeListenError('districts', err),
      ),
      onSnapshot(
        query(collection(db, 'churches'), orderBy('name', 'asc')),
        (snap) => {
          setChurches(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Church, 'id'>) })),
          );
        },
        (err) => safeListenError('churches', err),
      ),
      onSnapshot(
        query(collection(db, 'departments'), orderBy('name', 'asc')),
        (snap) => {
          setDepartments(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Department, 'id'>) })),
          );
        },
        (err) => safeListenError('departments', err),
      ),
      onSnapshot(
        query(collection(db, 'staff'), orderBy('fullName', 'asc')),
        (snap) => {
          setStaff(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StaffMember, 'id'>) })),
          );
        },
        (err) => safeListenError('staff', err),
      ),
      onSnapshot(
        query(collection(db, 'global_events'), orderBy('startDate', 'asc')),
        (snap) => {
          setGlobalEvents(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GlobalEvent, 'id'>) })),
          );
        },
        (err) => safeListenError('global_events', err),
      ),
      onSnapshot(
        query(collection(db, 'resources'), orderBy('title', 'asc')),
        (snap) => {
          setResources(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MissionResource, 'id'>) })),
          );
        },
        (err) => safeListenError('resources', err),
      ),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [firebaseUser]);

  const logAdminActivity = async (
    action: string,
    targetType: string,
    summary: string,
    targetId?: string,
  ) => {
    if (!firebaseUser) return;
    try {
      await addDoc(collection(db, 'admin_activity'), {
        actorId: firebaseUser.uid,
        actorName: firebaseUser.displayName || firebaseUser.email || 'Admin',
        action: action.slice(0, 120),
        targetType: targetType.slice(0, 64),
        ...(targetId ? { targetId: targetId.slice(0, 128) } : {}),
        summary: summary.slice(0, 500),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'admin_activity');
    }
  };

  return (
    <MissionContext.Provider
      value={{
        unions,
        missions,
        regions,
        districts,
        churches,
        departments,
        staff,
        globalEvents,
        resources,
        loadingHierarchy,
        logAdminActivity,
      }}
    >
      {children}
    </MissionContext.Provider>
  );
}

export function useMission(): MissionContextValue {
  const ctx = useContext(MissionContext);
  if (!ctx) throw new Error('useMission must be used inside MissionProvider');
  return ctx;
}

import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

export async function bootstrapSabahMissionBaseline(
  actorUid: string,
  actorName: string,
): Promise<void> {
  const now = serverTimestamp();
  const unionId = 'union_maum';
  const unionName = 'Malaysia Union Mission';
  const missionId = 'sam_sabah';

  try {
    // Tier 0: Union
    const unionRef = doc(db, 'unions', unionId);
    const unionSnap = await getDoc(unionRef);
    if (!unionSnap.exists()) {
      const uBatch = writeBatch(db);
      uBatch.set(unionRef, {
        name: unionName,
        code: 'MAUM',
        country: 'Malaysia',
        headquarters: 'Petaling Jaya, Selangor',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      await uBatch.commit();
    }

    // Tier 1: Mission
    const missionRef = doc(db, 'missions', missionId);
    const missionSnap = await getDoc(missionRef);
    if (!missionSnap.exists()) {
      const mBatch = writeBatch(db);
      mBatch.set(missionRef, {
        unionId,
        unionName,
        name: 'Sabah Adventist Mission',
        code: 'SAM',
        country: 'Malaysia',
        headquarters: 'Tamparuli, Sabah',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      await mBatch.commit();
    } else if (!missionSnap.data().unionId) {
      const mBatch = writeBatch(db);
      mBatch.update(missionRef, {
        unionId,
        unionName,
        updatedAt: now,
      });
      await mBatch.commit();
    }

    // Tier 2: Regions
    const regions = [
      { id: 'reg_west_coast', name: 'West Coast Region', code: 'WCR' },
      { id: 'reg_interior', name: 'Interior Region', code: 'INT' },
      { id: 'reg_east_coast', name: 'East Coast Region', code: 'ECR' },
    ];
    const rBatch = writeBatch(db);
    let rPending = 0;
    for (const r of regions) {
      const ref = doc(db, 'regions', r.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        rBatch.set(ref, {
          missionId,
          name: r.name,
          code: r.code,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        rPending++;
      }
    }
    if (rPending > 0) await rBatch.commit();

    // Tier 3: Districts
    const districts = [
      { id: 'dist_tamparuli', regionId: 'reg_west_coast', name: 'Tamparuli District' },
      { id: 'dist_kota_kinabalu', regionId: 'reg_west_coast', name: 'Kota Kinabalu District' },
      { id: 'dist_ranau', regionId: 'reg_interior', name: 'Ranau District' },
      { id: 'dist_keningau', regionId: 'reg_interior', name: 'Keningau District' },
      { id: 'dist_sandakan', regionId: 'reg_east_coast', name: 'Sandakan District' },
      { id: 'dist_tawau', regionId: 'reg_east_coast', name: 'Tawau District' },
    ];
    const dBatch = writeBatch(db);
    let dPending = 0;
    for (const d of districts) {
      const ref = doc(db, 'districts', d.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        dBatch.set(ref, {
          missionId,
          regionId: d.regionId,
          name: d.name,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        dPending++;
      }
    }
    if (dPending > 0) await dBatch.commit();

    // Tier 4: Churches, Departments, Special Events & Audit
    const churches = [
      { id: 'ch_tamparuli_central', regionId: 'reg_west_coast', districtId: 'dist_tamparuli', name: 'Tamparuli Central SDA Church', churchCode: 'SAM-001', memberCount: 420 },
      { id: 'ch_tuaran', regionId: 'reg_west_coast', districtId: 'dist_tamparuli', name: 'Tuaran SDA Church', churchCode: 'SAM-002', memberCount: 185 },
      { id: 'ch_kk_likas', regionId: 'reg_west_coast', districtId: 'dist_kota_kinabalu', name: 'Likas SDA Church', churchCode: 'SAM-010', memberCount: 510 },
      { id: 'ch_kk_penampang', regionId: 'reg_west_coast', districtId: 'dist_kota_kinabalu', name: 'Penampang SDA Church', churchCode: 'SAM-011', memberCount: 290 },
      { id: 'ch_ranau_central', regionId: 'reg_interior', districtId: 'dist_ranau', name: 'Ranau Central SDA Church', churchCode: 'SAM-021', memberCount: 245 },
      { id: 'ch_keningau_town', regionId: 'reg_interior', districtId: 'dist_keningau', name: 'Keningau Town SDA Church', churchCode: 'SAM-031', memberCount: 210 },
      { id: 'ch_sandakan_mile4', regionId: 'reg_east_coast', districtId: 'dist_sandakan', name: 'Sandakan Mile 4 SDA Church', churchCode: 'SAM-041', memberCount: 175 },
      { id: 'ch_tawau_central', regionId: 'reg_east_coast', districtId: 'dist_tawau', name: 'Tawau Central SDA Church', churchCode: 'SAM-051', memberCount: 160 },
    ];

    const departments = [
      {
        id: 'dept_ministerial',
        name: 'Ministerial Association',
        code: 'MIN',
        description: 'Pastoral care, Borang B reporting, ordination mentorship, and district evangelism support.',
        directorName: 'Pr. Ministerial Secretary',
        resourceUrl: 'https://www.ministerialassociation.org',
      },
      {
        id: 'dept_kanak_kanak',
        name: 'Kanak-Kanak (Children’s Ministry)',
        code: 'KKM',
        description: 'Children’s Sabbath School age-band programs, APTA family ministry, and KID curriculum.',
        directorName: 'Children’s Ministry Director',
        resourceUrl: 'https://children.adventist.org',
      },
      {
        id: 'dept_penatalayanan',
        name: 'Penatalayanan (Stewardship)',
        code: 'STW',
        description: 'Borang AP & Borang BP stewardship education, faithfulness campaigns, and member training.',
        directorName: 'Stewardship Director',
        resourceUrl: 'https://stewardship.adventist.org',
      },
      {
        id: 'dept_sspm',
        name: 'SSPM (Sabbath School & Personal Ministries)',
        code: 'SSPM',
        description: 'Sabbath School study guides, small group Bible study outreach, and literature distribution.',
        directorName: 'SSPM Director',
        resourceUrl: 'https://www.sabbathschoolpersonalministries.org',
      },
      {
        id: 'dept_wanita',
        name: 'Wanita (Women’s Ministry)',
        code: 'WM',
        description: 'Women’s fellowship circles, leadership development, welfare outreach, and devotional retreats.',
        directorName: 'Women’s Ministry Director',
        resourceUrl: 'https://women.adventist.org',
      },
    ];

    const specialEvents = [
      {
        id: 'ge_2026_q4_stewardship',
        title: 'Sabah Mission Stewardship Emphasis Sabbath',
        category: 'Special Sabbath',
        startDate: '2026-12-05',
        endDate: '2026-12-05',
        location: 'All Sabah Churches',
        description: 'Annual mission-wide stewardship commitment Sabbath and Borang AP/BP review.',
        isSpecialEvent: true,
      },
      {
        id: 'ge_2026_year_end_council',
        title: 'SAM Year-End Executive & Pastoral Council',
        category: 'Council',
        startDate: '2026-12-14',
        endDate: '2026-12-16',
        location: 'Tamparuli Mission Auditorium',
        description: 'Annual pastoral evaluation, district assignments, and 2027 strategic planning.',
        isSpecialEvent: true,
      },
    ];

    const finalBatch = writeBatch(db);
    let finalPending = 0;

    for (const c of churches) {
      const ref = doc(db, 'churches', c.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        finalBatch.set(ref, {
          missionId,
          regionId: c.regionId,
          districtId: c.districtId,
          name: c.name,
          churchCode: c.churchCode,
          memberCount: c.memberCount,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        finalPending++;
      }
    }

    for (const dept of departments) {
      const ref = doc(db, 'departments', dept.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        finalBatch.set(ref, {
          missionId,
          name: dept.name,
          code: dept.code,
          description: dept.description,
          directorName: dept.directorName,
          resourceUrl: dept.resourceUrl,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
        finalPending++;
      }
    }

    for (const ev of specialEvents) {
      const ref = doc(db, 'global_events', ev.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        finalBatch.set(ref, {
          missionId,
          title: ev.title,
          category: ev.category,
          startDate: ev.startDate,
          endDate: ev.endDate,
          location: ev.location,
          description: ev.description,
          isSpecialEvent: ev.isSpecialEvent,
          isActive: true,
          createdBy: actorUid,
          createdAt: now,
          updatedAt: now,
        });
        finalPending++;
      }
    }

    if (finalPending > 0) {
      finalBatch.set(doc(db, 'admin_activity', `bootstrap_${Date.now()}`), {
        actorId: actorUid,
        actorName,
        action: 'BOOTSTRAP_MISSION_BASELINE',
        targetType: 'missions',
        targetId: missionId,
        summary: 'Initialized Sabah Adventist Mission baseline regions, districts, churches, departments, and special events.',
        createdAt: now,
      });
      await finalBatch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'missions/sam_sabah');
  }
}

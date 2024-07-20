/**
 * Copyright 2022 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
"use strict";

const cors = require("cors")({
  // This is for testing. Don't do it in a real app.
  // See the documentation for more details:
  // https://firebase.google.com/docs/functions/beta/http-events
  origin: true,
});

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const utils = require("./utils.js");
const helpers = require("./helpers.js");
const { FieldPath } = require('firebase-admin/firestore');
admin.initializeApp();

const firestore = admin.firestore();

//함수 시작

/**
 * Generates random workout log data.
 * @return {Object} The workout log data.
 */
function generateRandomWorkoutLog() {
  const date = new Date();
  date.setSeconds(date.getSeconds() + Math.floor(Math.random() * 100000)); // Random date in the future
  const workoutTypes = ["routine", "test", "free", "custom"];
  const randomType = workoutTypes[Math.floor(Math.random() * workoutTypes.length)];

  let goalReps = null;
  let doneReps = null;

  if (randomType === "routine") {
    goalReps = Array.from({ length: 5 }, (_, i) => 5 - i);
    doneReps = [...goalReps];
  } else if (randomType === "test") {
    doneReps = [Math.floor(Math.random() * 15) + 1]; // One set with random reps
  } else if (randomType === "free") {
    const sets = Math.floor(Math.random() * 10) + 1; // Random number of sets
    doneReps = Array.from({ length: sets }, () => Math.floor(Math.random() * 10) + 1);
  } else if (randomType === "custom") {
    const sets = Math.floor(Math.random() * 7) + 3; // Random number of sets between 3 and 10
    goalReps = Array.from({ length: sets }, () => Math.floor(Math.random() * 5) + 1);
    doneReps = [...goalReps];
  }

  const randomTotalTime = Math.floor(Math.random() * 120); // Random total time between 0 and 120 minutes

  return {
    workoutType: "pullup",
    workoutSubType: randomType,
    date: date.toISOString(),
    goalReps: goalReps ? JSON.stringify(goalReps) : null,
    doneReps: JSON.stringify(doneReps),
    totalTime: randomTotalTime,
  };
}

/**
 * Generates random pullup details data.
 * @param {number} length The length of the tempo array.
 * @return {Object} The pullup details data.
 */
function generateRandomPullupDetails(length) {
  const randomUpTime = Math.floor(Math.random() * 20 * length + 1); // Random up time
  const randomDownTime = Math.floor(Math.random() * 20 * length + 1); // Random down time
  const randomTempo = Array.from({ length: length }, () => Math.floor(Math.random() * 21) + 35); // Random tempo between 35 and 55

  return {
    upTime: randomUpTime,
    downTime: randomDownTime,
    tempo: JSON.stringify(randomTempo),
  };
}

/**
 * Adds 20 random workout logs and pullup details for a user.
 * @param {string} userID The ID of the user.
 * @param {number} size The number of workout logs to add.
 * @return {Promise<void>} Returns a promise that resolves when the data is added.
 */
async function createDummyWorkoutLogs(userID, size) {
  const batch = firestore.batch();
  const workoutLogsCollection = `users/${userID}/workout_logs_datetime_id`;
  const pullupDetailsCollection = `users/${userID}/pullup_details_datetime_id`;

  for (let i = 0; i < size; i++) {
    const workoutLog = generateRandomWorkoutLog();
    const pullupDetails = generateRandomPullupDetails(JSON.parse(workoutLog.doneReps).length);

    const workoutLogRef = firestore.collection(workoutLogsCollection).doc(workoutLog.date);
    const pullupDetailsRef = firestore.collection(pullupDetailsCollection).doc(workoutLog.date);

    batch.set(workoutLogRef, workoutLog);
    batch.set(pullupDetailsRef, pullupDetails);
  }

  return await batch.commit();
  //console.log("Dummy workout logs and pullup details added successfully.");
}


exports.addDummyWorkoutLogs = functions.https.onRequest(async (req, res) => {
  cors(req, res, () => {
    const userID = req.body.data.playerID;
    createDummyWorkoutLogs(userID, 10).then((result) => {
      res.json({result: `Dummies created: ${result}`});
    });
  });
});

exports.addDummyWorkoutLog = functions.https.onRequest(async (req, res) => {
  cors(req, res, () => {
    const userID = req.body.data.playerID;
    createDummyWorkoutLogs(userID, 1).then((result) => {
      res.json({result: `Dummy created: ${result}`});
    });
  });
});


//n명의 유저를 생성함과 동시에 운동 기록도 추가
exports.addDummyPlayers = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    const startIndex = req.body.data.startIndex;
    const length = req.body.data.length;

    try {
      const promises = [];
      for (let i = startIndex; i < startIndex + length; i++) {
        promises.push(createDummyWorkoutLogs(i.toString(), 10));
      }
      
      const results = await Promise.all(promises);
      res.json({ result: `Dummies created: ${results.length}` });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

//더미 세팅 함수 끝
//실제 중요 함수 구현 시작

//유저 개인별 - 운동 기록이 추가될 때 마다 풀업 점수 업데이트 (디바운싱 적용
//풀업 티어 처리 - 다른 폴더로 빼서 처리
//workoug log 추가될때마다 트리거
exports.onWorkoutLogCreate = functions.firestore
  .document('users/{userID}/workout_logs_datetime_id/{logDateTime}')
  .onCreate(async (snapshot, context) => {
    const userID = context.params.userID;
    const workoutData = snapshot.data();
    const userRef = firestore.collection('users').doc(userID);

    //풀업, 푸시업인 경우 따로 처리함
    //새롭게 추가된 운동 종류에 따라서 문서 읽기 조건아 바뀜


    //새롭게 추가된 운동 종류 type 확인
    let workoutType = workoutData.workoutType;
    if (workoutType !== 'pullup') {
      //풀업이 아니라면 종료
      return null;
    }
    
    const workoutLogsSnapshot = await userRef.collection('workout_logs_datetime_id')
      .orderBy('date', 'desc')
      .where('workoutType', '==', workoutType)
      .limit(10)
      .get();
    
    if(workoutLogsSnapshot.empty) {
      return null;
    }
    
    //workoutLogsSnapshot의 날짜와 같은 풀업 디테일을 가져옴
    //in 연산자는 10개 이하에서만 작동!!
    const pullupDetailsSnapshot = await userRef.collection('pullup_details_datetime_id')
      .where(FieldPath.documentId(), 'in', workoutLogsSnapshot.docs.map(doc => doc.id))
      .get();
    

    let totalScore = 0;
    let totalCount = 0;

    workoutLogsSnapshot.forEach(doc => {
      // dateTime이 같은 pullupDetails 찾기
      const pullupDetails = pullupDetailsSnapshot.docs.find(pullupDoc => pullupDoc.id === doc.id);
      if (pullupDetails) {
        let upTime = pullupDetails.data().upTime;
        let downTime = pullupDetails.data().downTime;
        if (upTime + downTime !== 0) {
          let negativeRatio = downTime / (upTime + downTime);
          let singleScore = helpers.computePullupTierScore(
            JSON.parse(doc.data().doneReps),
            JSON.parse(pullupDetails.data().tempo),
            negativeRatio
          );
          totalScore += singleScore;
          totalCount += 1;
        }
      }
    });
    
    let resultScore = 0;
    if (totalCount != 0) {
      resultScore = totalScore / totalCount;
    }

    await userRef.set({ pullupTierScore: resultScore }, { merge: true });
  });

//8시간마다 국가별 유저의 풀업 점수 합 랭킹 업데이트 로직
//

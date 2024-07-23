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
  // Generates a random date in the future
  const date = new Date();
  date.setSeconds(date.getSeconds() + Math.floor(Math.random() * 100000));

  // Randomly selects a workout sub-type
  const workoutTypes = ["routine", "test", "free", "custom"];
  const randomType = workoutTypes[Math.floor(Math.random() * workoutTypes.length)];

  let goalReps = null;
  let doneReps = null;
  let sets = 0;

  // Generates goalReps and doneReps based on the workout sub-type
  if (randomType === "routine") {
    goalReps = Array.from({ length: 5 }, (_, i) => 5 - i);
    doneReps = [...goalReps];
  } else if (randomType === "test") {
    doneReps = [Math.floor(Math.random() * 15) + 1]; // One set with random reps
  } else if (randomType === "free") {
    sets = Math.floor(Math.random() * 10) + 1; // Random number of sets
    doneReps = Array.from({ length: sets }, () => Math.floor(Math.random() * 10) + 1);
  } else if (randomType === "custom") {
    sets = Math.floor(Math.random() * 7) + 3; // Random number of sets between 3 and 10
    goalReps = Array.from({ length: sets }, () => Math.floor(Math.random() * 5) + 1);
    doneReps = [...goalReps];
  }

  // Random total time between 0 and 120 minutes
  const randomTotalTime = Math.floor(Math.random() * 120);

  // Generates random pullup details
  const length = randomType === "test" ? 1 : (goalReps ? goalReps.length : doneReps.length);
  const randomUpTime = Math.floor(Math.random() * 20 * length + 1); // Random up time
  const randomDownTime = Math.floor(Math.random() * 20 * length + 1); // Random down time
  const randomTempo = Array.from({ length: length }, () => Math.floor(Math.random() * 21) + 35); // Random tempo between 35 and 55

  return {
    workoutType: "pullup",
    workoutSubType: randomType,
    date: date.toISOString(),
    goalReps: goalReps ? JSON.stringify(goalReps) : null,
    doneReps: JSON.stringify(doneReps),
    totalTime: randomTotalTime,
    pullupDetails: {
      upTime: randomUpTime,
      downTime: randomDownTime,
      tempo: JSON.stringify(randomTempo),
    }
  };
}




/**
 * @param {string} userID The ID of the user.
 * @param {number} size The number of workout logs to add.
 * @return {Promise<void>} Returns a promise that resolves when the data is added.
 */
async function createDummyWorkoutLogs(userID, size) {
  const stringId = `${userID}`;
  const userRef = firestore.collection('users').doc(stringId).collection('workout_logs_array').doc('0');

  //읽기 1회
  const userDoc = await userRef.get();

  // 기존 운동 기록을 가져오거나 초기화
  let workoutLogs = userDoc.exists && userDoc.data().workoutLogs ? userDoc.data().workoutLogs : [];

  // 새로운 운동 기록 생성
  for (let i = 0; i < size; i++) {
    const workoutLog = generateRandomWorkoutLog();
    workoutLogs.push(workoutLog);
  }
  console.log(workoutLogs);
  
  // Firestore 업데이트
  // 쓰기 1회
  return await userRef.set({ workoutLogs: workoutLogs }, { merge: true });
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

const countries = [
  "United States", "Canada", "United Kingdom", "Germany", "France","South Korea",
];

exports.onUserCreate = functions.firestore
  .document('users/{userID}/workout_logs_array/0')
  .onCreate(async (snap, context) => {
    const userID = context.params.userID;
    const randomCountry = countries[Math.floor(Math.random() * countries.length)];

    // 유저 문서에 랜덤 국가 추가
    await firestore.collection('users').doc(userID).set({
      country: randomCountry
    }, { merge: true });  // merge: true를 사용하여 기존 필드와 병합
    console.log(`User ${userID} created with country ${randomCountry}`);

    updatePullupScore(userID, snap.data());
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

// //더미 세팅 함수 끝
// //실제 중요 함수 구현 시작

// //유저 개인별 - 운동 기록이 추가될 때 마다 풀업 점수 업데이트 (디바운싱 적용
// //풀업 티어 처리 - 다른 폴더로 빼서 처리
// //workoug log 추가될때마다 트리거
exports.onWorkoutLogCreate = functions.firestore
  .document('users/{userID}/workout_logs_array/0')
  .onUpdate(async (change, context) => {
    updatePullupScore(context.params.userID, change.after.data());
  });

async function updatePullupScore(userID, data) {
    const newValue = data;  // 새롭게 업데이트된 데이터

    // 운동 기록 배열을 가져오기
    const workoutLogs = newValue.workoutLogs || [];
    console.log(workoutLogs);
    // `pullup` 운동 기록만 필터링
    const pullupLogs = workoutLogs.filter(log => log.workoutType === 'pullup');
    console.log(pullupLogs);
    if (pullupLogs.length === 0) {
      return null;
    }

    let totalScore = 0;
    let totalCount = 0;

    pullupLogs.forEach(log => {
      let upTime = log.pullupDetails.upTime;
      let downTime = log.pullupDetails.downTime;

      if (upTime + downTime !== 0) {
        let negativeRatio = downTime / (upTime + downTime);
        let singleScore = helpers.computePullupTierScore(
          JSON.parse(log.doneReps),
          negativeRatio,
          JSON.parse(log.pullupDetails.tempo)
        );
        totalScore += singleScore;
        totalCount += 1;
      }
    });
    
    let resultScore = -1;
    if (totalCount !== 0) {
      resultScore = totalScore / totalCount;
    }

    await firestore.collection('users').doc(userID).set({ pullupTierScore: resultScore }, { merge: true });
}


//8시간마다 국가별 유저의 풀업 점수 합 랭킹 업데이트 로직
exports.updateCountryRankings = functions.pubsub.schedule('every 2 minutes').onRun(async (context) => {
  const usersSnapshot = await firestore.collection('users').get();

  // 국가별로 pullupTierScore를 합산
  const countryScores = {};
  usersSnapshot.forEach(doc => {
    const userData = doc.data();
    if (userData.country && userData.pullupTierScore !== undefined) {
      if (!countryScores[userData.country]) {
        countryScores[userData.country] = { totalScore: 0, userCount: 0 };
      }
      countryScores[userData.country].totalScore += userData.pullupTierScore;
      countryScores[userData.country].userCount += 1;
    }
  });

  // 각 국가별 랭킹 계산
  const countryRankings = Object.entries(countryScores).map(([country, { totalScore, userCount }]) => {
    return {
      country: country,
      totalScore: totalScore,
      averageScore: totalScore / userCount,
    };
  });

  // totalScore를 기준으로 내림차순 정렬
  countryRankings.sort((a, b) => b.totalScore - a.totalScore);

  // Firestore에 저장
  const rankingsRef = firestore.collection('rankings').doc('country_rankings');
  await rankingsRef.set({ rankings: countryRankings });

  console.log('Country rankings updated:', countryRankings);
  return null;
});


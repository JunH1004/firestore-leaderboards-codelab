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

import { getApp } from "https://www.gstatic.com/firebasejs/9.14.0/firebase-app.js";
import { getFirestore, collection, getCountFromServer } from "https://www.gstatic.com/firebasejs/9.14.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.14.0/firebase-functions.js";

async function invokeFunctionCall(name) {
  const functions = getFunctions();
  const callable = httpsCallable(functions, name);
  callable({})
    .then((result) => {
    console.log(result);
  });
}

export async function addDummyPlayers(startIndex, length) {
  const functions = getFunctions();
  const callable = httpsCallable(functions, "addDummyPlayers");
  callable({startIndex: startIndex, length: length})
    .then((result) => {
    console.log(result);
  });
}

export async function addDummyWorkoutLog(userID) {
  const functions = getFunctions();
  const callable = httpsCallable(functions, "addDummyWorkoutLog");
  callable({playerID: userID})
    .then((result) => {
    console.log(result);
  });
}

export async function addDummyWorkoutLogs(userID) {
  const functions = getFunctions();
  const callable = httpsCallable(functions, "addDummyWorkoutLogs");
  callable({playerID: userID})
    .then((result) => {
    console.log(result);
  });
}

export function codelab() {
  console.log("Welcome to the leaderboards codelab!");
}

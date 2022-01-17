import { supabase } from "../db";
import fetch from "node-fetch";
import { Course } from "../courses/Course";

const STATES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];

type CourseLocation = Pick<Course, "city" | "state"> & {
  id: number;
  townLat?: number;
  townLong?: number;
};

export type TownDTO = Pick<Course, "city" | "state"> & {
  townLat: number;
  townLong: number;
};

const GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places/";

export const setTownCoordinates = async (states: string[]) => {
  let { townDTOs, coordinateQueryUrls } = await getTownLocationQueriesForState(
    states
  );
  let coursesInState = await getAllCoursesInState(states[0]);
  await getTownCoordinates(townDTOs, coordinateQueryUrls);
  coursesInState = updateCoursesWithTownCoords(townDTOs, coursesInState);
  return await upsertCoursesWithNewCoords(coursesInState);
};
const getTownLocationQueriesForState = async (
  states: string[]
): Promise<{ townDTOs: TownDTO[]; coordinateQueryUrls: string[] }> => {
  let townDTOs: TownDTO[] = [];
  let coordinateQueryUrls: string[];
  for (const state of states) {
    const { data, error } = await supabase.rpc("gettownsinstate", {
      inputstate: state,
    });
    if (!error) {
      console.log(`Returning ${data.length} towns in ${state}`);
      coordinateQueryUrls = data.map(
        (town: { city: string; state: string }) => {
          townDTOs.push({ city: town.city, state, townLat: 0, townLong: 0 });
          const townSerialized = encodeURI(`${town.city} ${state}`);
          return `${GEOCODING_URL}${townSerialized}.json?access_token=${process.env.MAPBOX_ACCESS_TOKEN}`;
        }
      );
    } else {
      console.log(error);
    }
  }
  return { townDTOs, coordinateQueryUrls };
};

const getAllCoursesInState = async (
  state: string
): Promise<CourseLocation[]> => {
  let result: CourseLocation[];
  let error;
  try {
    let response = await supabase
      .from("courses")
      .select("id, city, state")
      .match({ state });
    result = response.data as any;
    error = response.error;
  } catch {
    console.log(error);
  }
  error && console.log(error);
  return result;
};

const getTownCoordinates = async (
  towns: TownDTO[],
  queries: string[]
): Promise<TownDTO[]> => {
  let location;
  let idx;
  try {
    for (idx = 0; idx < towns.length; idx++) {
      location = await fetch(queries[idx]);
      const { features } = await location.json();
      console.log(
        `Just got coords for ${towns[idx].city}, ${towns[idx].state} in getTownCoordinates`
      );
      towns[idx] = {
        ...towns[idx],
        townLat: features[0].center[1],
        townLong: features[0].center[0],
      };
    }
  } catch {
    if (location.error) console.log(location.error);
    throw new Error(
      `Could not find coordinates for: ${towns[idx].city}, ${towns[idx].state}`
    );
  }
  console.log("Returning from getTownCoordinates");
  return towns;
};

const updateCoursesWithTownCoords = (
  towns: TownDTO[],
  courses: CourseLocation[]
): CourseLocation[] => {
  towns.forEach((town) => {
    let matches = courses.filter(
      (course) => course.state === town.state && course.city === town.city
    );
    matches.forEach((course) => {
      course.townLat = town.townLat;
      course.townLong = town.townLong;
    });
  });
  return courses;
};

const upsertCoursesWithNewCoords = async (
  courses: CourseLocation[]
): Promise<any> => {
  let { data, error } = await supabase.from("courses").upsert(courses);
  if (error) {
    console.log(error);
  }
  return data;
};

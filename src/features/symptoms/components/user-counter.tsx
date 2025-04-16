import { useState } from "react";
import street from "@assets/map_selection/street.png";
import satellite from "@assets/map_selection/satelital.png";
import outdoors from "@assets/map_selection/outdoor.png";
import dark from "@assets/map_selection/dark.png";
import light from "@assets/map_selection/light.png";
import Image from "next/image";
import { Tooltip } from "flowbite-react";

const color_selector = [
  "bg-red-300 dark:bg-red-600 text-red-900 dark:text-red-100",
  "bg-blue-300 dark:bg-blue-600 text-blue-900 dark:text-blue-100",
  "bg-green-300 dark:bg-green-600 text-green-900 dark:text-green-100",
  "bg-yellow-300 dark:bg-yellow-600 text-yellow-900 dark:text-yellow-100",
  "bg-purple-300 dark:bg-purple-600 text-purple-900 dark:text-purple-100",
]

const users = [
  {
    "firstName": "Antonia",
    "lastName": "Candia",
    "trip_id": null,
    "symptom_name": null,
    "end_timestamp": null,
    "icu_code": null,
    "start_timestamp": null,
    "email": "agcandia@mintral.cl",
    "status": "offline",
    "username": "agcandia@mintral.cl",
    "isTreating": false
  },
  {
    "firstName": "Constanza",
    "lastName": "Cornejo",
    "trip_id": "1468539",
    "symptom_name": "Speed Limit Standard",
    "end_timestamp": "2025-04-14T17:55:56.246928+00:00",
    "icu_code": 3,
    "start_timestamp": "2025-04-14T17:55:56.246928+00:00",
    "email": "ccornejos@mintral.cl",
    "status": "offline",
    "username": "ccornejos@mintral.cl",
    "isTreating": false
  },
  {
    "firstName": "Danilo",
    "lastName": "Borquez",
    "trip_id": null,
    "symptom_name": null,
    "end_timestamp": null,
    "icu_code": null,
    "start_timestamp": null,
    "email": "ddborquez@mintral.cl",
    "status": "offline",
    "username": "ddborquez@mintral.cl",
    "isTreating": false
  },
  {
    "firstName": "Daphne",
    "lastName": "Rojas",
    "trip_id": null,
    "symptom_name": null,
    "end_timestamp": null,
    "icu_code": null,
    "start_timestamp": null,
    "email": "drojasp@mintral.cl",
    "status": "offline",
    "username": "drojasp@mintral.cl",
    "isTreating": false
  },
  {
    "firstName": "Erick",
    "lastName": "Hernández",
    "trip_id": "1465891",
    "symptom_name": "Continuous Drive Check",
    "end_timestamp": "2025-04-09T20:50:26.890516+00:00",
    "icu_code": 4,
    "start_timestamp": "2025-04-09T20:49:45.581901+00:00",
    "email": "erick@microboxlabs.com",
    "status": "offline",
    "username": "erick@microboxlabs.com",
    "isTreating": false
  },
  {
    "firstName": "Gabriel",
    "lastName": "Atencio",
    "trip_id": "1465891",
    "symptom_name": "Continuous Drive Check",
    "end_timestamp": "2025-04-09T19:35:27.981802+00:00",
    "icu_code": 4,
    "start_timestamp": "2025-04-09T19:35:27.981802+00:00",
    "email": "gabriel@microboxlabs.com",
    "status": "offline",
    "username": "gabriel@microboxlabs.com",
    "isTreating": false
  },
  {
    "firstName": "Geilen",
    "lastName": "Loaiza",
    "trip_id": null,
    "symptom_name": null,
    "end_timestamp": null,
    "icu_code": null,
    "start_timestamp": null,
    "email": "gloaizar@mintral.cl",
    "status": "offline",
    "username": "gloaizar@mintral.cl",
    "isTreating": false
  },
  {
    "firstName": "Ivan",
    "lastName": "Vargas",
    "trip_id": null,
    "symptom_name": null,
    "end_timestamp": null,
    "icu_code": null,
    "start_timestamp": null,
    "email": "ivargasm@mintral.cl",
    "status": "offline",
    "username": "ivargasm@mintral.cl",
    "isTreating": false
  },
  {
    "firstName": "Karla",
    "lastName": "Castillo",
    "trip_id": null,
    "symptom_name": null,
    "end_timestamp": null,
    "icu_code": null,
    "start_timestamp": null,
    "email": "kcastilloa@mintral.cl",
    "status": "offline",
    "username": "kcastilloa@mintral.cl",
    "isTreating": false
  },
  {
    "firstName": "Manuel",
    "lastName": "Perez",
    "trip_id": "1462618",
    "symptom_name": "Speed Limit Standard",
    "end_timestamp": "2025-03-29T00:55:24.182156+00:00",
    "icu_code": 3,
    "start_timestamp": "2025-03-29T00:45:15.291816+00:00",
    "email": "maperezc@mintral.cl",
    "status": "online",
    "username": "maperezc@mintral.cl",
    "isTreating": false
  },
  {
    "firstName": "Natalia",
    "lastName": "Llanos",
    "trip_id": null,
    "symptom_name": null,
    "end_timestamp": null,
    "icu_code": null,
    "start_timestamp": null,
    "email": "nllanosp@mintral.cl",
    "status": "offline",
    "username": "nllanosp@mintral.cl",
    "isTreating": false
  },
]

// "trip_id": "1450767", 
// "icu_code": 2, 
// "in_treatment": true, 
// "symptom_name": "Continuous Drive Check", 
// "end_timestamp": null, 
// "start_timestamp": "2025-03-11T18:47:08.089126-05:00"

export default function UserStateCounter() {

  const [open, setOpen] = useState(false);
  return (
    <div
      className="flex flex-row transition-all duration-300 cursor-pointer space-x-[-2.5rem] hover:space-x-2"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {users.map((user, index) => {
        const random_tailwind_color = color_selector[Math.floor(Math.random() * color_selector.length)];
          return (
            
            <div
              key={index}
              className={`border-2 ${open ? 'border-2' : 'border-transparent'} flex justify-center items-center transition-all duration-300 rounded-full p-1 first:p-0 ${random_tailwind_color} h-10 w-10`}
            >
              <Tooltip content={tooltipContent(user)}>
                {user.firstName[0]}{user.lastName[0]}
              </Tooltip>
            </div>)
        }
      )}
      {
      /*users.length > 3 && (
        <div className="border-2 border-white flex justify-center items-center transition-all duration-300 rounded-full p-1 first:p-0 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100 h-10 w-10">
          +{users.length - 3}
        </div>
      )*/}
    </div>
  );
}
function tooltipContent(user: any) {
  switch (user.status) {
    case "offline":
      return <div>Desconectado</div>;
    case "online":

      return <div>Online</div>;
    default:
      return <div>Unknown status</div>;
  }
}
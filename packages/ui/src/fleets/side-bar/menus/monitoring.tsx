import ExpandableButton from "../../../buttons/expansible-button"

const test_data = [
    {
        title: "Services",
        icon: <FaArrowsRotate />,
        items: [
            {
            key: "Trips",
            value: 0,
            },
            {
            key: "Emergencies",
            value: 0,
            },
            {
            key: "In Transit",
            value: 0,
            },
            {
            key: "In Destination",
            value: 0,
            },
            {
            key: "Monitoring Hours",
            value: 0,
            },
            {
            key: "Monitored Distance",
            value: 0,
            },
        ],
        },
        {
        title: "Fleets",
        icon: <HiTruck />,
        items: [
            {
            key: active_monitored,
            value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[1]?.items?.[0]?.value
                : 0,
            },
            {
            key: vehicles as string,
            value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[1]?.items?.[1]?.value
                : 0,
            },
            {
            key: (dict.symptoms as I18nRecord).vehicle_signal_quality as string,
            value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[1]?.items?.[2]?.value
                : 0,
            },
            {
            key: (dict.symptoms as I18nRecord).vehicle_signal_delay as string,
            value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[1]?.items?.[3]?.value
                : 0,
            },
            {
            key: (dict.symptoms as I18nRecord).containers as string,
            value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[1]?.items?.[4]?.value
                : 0,
            },
            {
            key: (dict.symptoms as I18nRecord).drivers as string,
            value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[1]?.items?.[5]?.value
                : 0,
            },
        ],
        },
        {
        title: (dict.symptoms as I18nRecord).symptoms as string,
        icon: <GiAtom />,
        items: [
            {
            key: (dict.symptoms as I18nRecord).stable as string,
            value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[2]?.items?.[0]?.value
                : 0,
            },
            {
            key: (dict.symptoms as I18nRecord).in_observation as string,
            value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[2]?.items?.[1]?.value
                : 0,
            },
            {
            key: (dict.symptoms as I18nRecord).compromised as string,
            value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[2]?.items?.[2]?.value
                : 0,
            },
            {
            key: (dict.symptoms as I18nRecord).critical as string,
            value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[2]?.items?.[3]?.value
                : 0,
            },
            {
            key: (dict.symptoms as I18nRecord).black_code as string,
            value: mapPositionsResume?.sections
                ? mapPositionsResume?.sections[2]?.items?.[4]?.value
                : 0,
            },
        ],
        },
    ]

export default function Monitoring() {
    return <div className="flex flex-col gap-2">
            <ExpandableButton
                initial_state={true}
                description="This is a description"
                icon={<div>A</div>}
                title="Monitoring"
                withBorder={true}
            >
                Hola
            </ExpandableButton>
            <ExpandableButton
                initial_state={true}
                description="This is a description"
                icon={<div>A</div>}
                title="Monitoring"
                withBorder={true}
            >
                Hola
            </ExpandableButton>
            <ExpandableButton
                initial_state={true}
                description="This is a description"
                icon={<div>A</div>}
                title="Monitoring"
                withBorder={true}
            >
                Hola
            </ExpandableButton>
        </div>
}
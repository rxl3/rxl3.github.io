import { Component, OnInit } from '@angular/core';
import * as mapboxgl from 'mapbox-gl';
import { Map } from 'mapbox-gl';
import { environment } from 'src/environments/environment';
import { HttpClient } from '@angular/common/http';
import { combineLatest, Observable } from 'rxjs';
import { Feature, MultiPolygon } from 'geojson';
import { FnParam } from '@angular/compiler/src/output/output_ast';

export interface Locality {
    Name: string;
}

export enum Offences {
    Homicide = 'Homicide',
    SexualOffences = 'Sexual Offences',
    AssaultFamily = 'Assault (Family)',
    AssaultNonFamily = 'Assault (Non-Family)',
    ThreateningFamily = 'Threatening Behaviour (Family)',
    ThreateningNonFamily = 'Threatening Behaviour (Non-Family)',
    Deprivation = 'Deprivation of Liberty',
    Robbery = 'Robbery',
    DwellingBurglary = 'Dwelling Burglary',
    NonDwellingBurglary = 'Non-Dwelling Burglary',
    StealingMotorVehicle = 'Stealing of Motor Vehicle',
    Stealing = 'Stealing',
    PropertyDamage = 'Property Damage',
    Arson = 'Arson',
    DrugOffences = 'Drug Offences',
    Graffiti = 'Graffiti',
    Fraud = 'Fraud & Related Offences',
    BreachOfRestraint = 'Breach of Violence Restraint Order',
}

export enum FinancialYears {
    '2011-12' = '2011-12',
    '2012-13' = '2012-13',
    '2013-14' = '2013-14',
    '2014-15' = '2014-15',
    '2015-16' = '2015-16',
    '2016-17' = '2016-17',
    '2017-18' = '2017-18',
    '2018-19' = '2018-19',
    '2019-20' = '2019-20',
    '2020-21' = '2020-21',
    '2021-22' = '2021-22',
}

export interface Crime {
    Id: number;
    Locality: string;
    Offence: Offences;
    FinancialYear: FinancialYears;
    July: number;
    August: number;
    September: number;
    October: number;
    November: number;
    December: number;
    January: number;
    February: number;
    March: number;
    April: number;
    May: number;
    June: number;
    TotalAnnual: number;
}

@Component({
    selector: 'app-map',
    templateUrl: './map.component.html',
    styleUrls: ['./map.component.scss'],
})
export class MapComponent implements OnInit {
    map: Map;
    style = 'mapbox://styles/mapbox/streets-v11';
    lat = -31.95;
    lng = 115.86;

    minLat = -32.63;
    maxLat = -31.55;

    minLng = 115.63;
    maxLng = 116.08;

    geoJsonData: GeoJSON.FeatureCollection<GeoJSON.MultiPolygon>;

    geoJsonUrl = 'assets/suburbs.geojson';
    localitiesUrl = 'assets/localities.json';
    statsUrl = 'assets/locality_stats.json';
    populationsUrl = 'assets/population_data.json';

    hoveredSuburbId: any = null;
    hoveredSuburbName: string;

    localities: Locality[];
    localityStats: Crime[][];

    offenceList: Offences[];

    selectedOffenceFilters: Offences[];

    populations: any;

    highestCrimeRateLocalities: any[];
    lowestCrimeRateLocalities: any[];

    filteredGeoJsonData: GeoJSON.FeatureCollection<GeoJSON.MultiPolygon>;

    constructor(private http: HttpClient) {
        this.offenceList = Object.values(Offences);
        this.selectedOffenceFilters = [...this.offenceList];
    }

    toTitleCase(str: string): string {
        let arr = str.split(' ');
        arr = arr.map((s) => s[0].toUpperCase() + s.slice(1).toLowerCase());
        return arr.join(' ');
    }

    ngOnInit(): void {
        combineLatest([
            this.http.get<GeoJSON.FeatureCollection<GeoJSON.MultiPolygon>>(
                this.geoJsonUrl
            ),
            this.http.get<Locality[]>(this.localitiesUrl),
            this.http.get<Crime[][]>(this.statsUrl),
            this.http.get<any>(this.populationsUrl),
        ]).subscribe(
            ([
                geoJsonResponse,
                localitiesResponse,
                statsResponse,
                populationsResponse,
            ]) => {
                this.geoJsonData = geoJsonResponse;
                this.localities = localitiesResponse;
                this.localityStats = statsResponse;
                this.populations = populationsResponse;

                let suburbsInBounds: Feature<
                    MultiPolygon,
                    {
                        [name: string]: any;
                    }
                >[] = [];

                geoJsonResponse.features.forEach((f) => {
                    const poly: MultiPolygon = f.geometry;

                    let isWithinBounds = false;

                    for (let i = 0; i < poly.coordinates.length; i++) {
                        if (
                            +poly.coordinates[0][0][i][0] < this.maxLng &&
                            +poly.coordinates[0][0][i][0] > this.minLng &&
                            +poly.coordinates[0][0][i][1] < this.maxLat &&
                            +poly.coordinates[0][0][i][1] > this.minLat
                        ) {
                            isWithinBounds = true;
                            break;
                        }
                    }

                    if (isWithinBounds) {
                        suburbsInBounds.push(f);
                    }
                });

                this.geoJsonData.features = suburbsInBounds;

                this.filteredGeoJsonData = this.geoJsonData;

                this.recalculateCrimeRates();

                this.map = new mapboxgl.Map({
                    accessToken: environment.mapbox.accessToken,
                    container: 'map',
                    style: this.style,
                    zoom: 12,
                    center: [this.lng, this.lat],
                });

                const bounds: mapboxgl.LngLatBoundsLike = [
                    this.minLng,
                    this.minLat,
                    this.maxLng,
                    this.maxLat,
                ];

                this.map.setMaxBounds(bounds);

                // Add map controls
                this.map.addControl(new mapboxgl.NavigationControl());

                this.map.on('load', () => {
                    // Add a data source containing GeoJSON data.
                    this.map.addSource('westernAustralia', {
                        type: 'geojson',
                        data: this.filteredGeoJsonData,
                        generateId: true,
                    });

                    // Add a new layer to visualize the polygon.
                    this.map.addLayer({
                        id: 'suburb-fills',
                        type: 'fill',
                        source: 'westernAustralia', // reference the data source
                        layout: {},
                        paint: {
                            'fill-color': [
                                'interpolate',
                                ['linear'],
                                ['get', 'crime-rate'],
                                0,
                                '#F6E7D8',
                                4,
                                '#F68989',
                                6,
                                '#C65D7B',
                                10,
                                '#874356',
                                100,
                                '#000',
                            ],
                            'fill-opacity': [
                                'case',
                                ['boolean', ['feature-state', 'hover'], false],
                                0.85,
                                0.5,
                            ],
                        },
                    });
                    // Add a black outline around the polygon.
                    this.map.addLayer({
                        id: 'outline',
                        type: 'line',
                        source: 'westernAustralia',
                        layout: {},
                        paint: {
                            'line-color': '#627BC1',
                            'line-width': 2,
                        },
                    });

                    // When the user moves their mouse over the state-fill layer, we'll update the
                    // feature state for the feature under the mouse.
                    this.map.on(
                        'mousemove',
                        'suburb-fills',
                        (e: mapboxgl.MapLayerMouseEvent) => {
                            // console.log(e);
                            if (e && e.features && e.features.length > 0) {
                                if (this.hoveredSuburbId !== null) {
                                    this.map.setFeatureState(
                                        {
                                            source: 'westernAustralia',
                                            id: this.hoveredSuburbId,
                                        },
                                        { hover: false }
                                    );
                                }
                                this.hoveredSuburbId = e.features[0].id;
                                this.hoveredSuburbName =
                                    e.features[0].properties['wa_local_2'];
                                this.map.setFeatureState(
                                    {
                                        source: 'westernAustralia',
                                        id: this.hoveredSuburbId,
                                    },
                                    { hover: true }
                                );
                            }
                        }
                    );

                    // When the mouse leaves the state-fill layer, update the feature state of the
                    // previously hovered feature.
                    this.map.on('mouseleave', 'suburb-fills', () => {
                        if (this.hoveredSuburbId !== null) {
                            this.map.setFeatureState(
                                {
                                    source: 'westernAustralia',
                                    id: this.hoveredSuburbId,
                                },
                                { hover: false }
                            );
                        }
                        this.hoveredSuburbId = null;
                        this.hoveredSuburbName = null;
                    });

                    this.map.on(
                        'click',
                        'suburb-fills',
                        (e: mapboxgl.MapLayerMouseEvent) => {
                            const locality = this.localities.find(
                                (l) =>
                                    l.Name.toUpperCase() ===
                                    this.hoveredSuburbName
                            );

                            if (locality) {
                                let offenceCount = 0;

                                const population: number =
                                    this.populations[
                                        locality.Name.toUpperCase()
                                    ];

                                const stats = this.localityStats.find(
                                    (s) => s[0].Locality === locality.Name
                                );

                                if (stats) {
                                    stats.forEach((s) => {
                                        if (
                                            this.selectedOffenceFilters.includes(
                                                s.Offence
                                            )
                                        ) {
                                            offenceCount += +s.TotalAnnual;
                                        }
                                    });
                                }

                                const markerHeight = 50;
                                const markerRadius = 10;
                                const linearOffset = 25;
                                const popupOffsets: mapboxgl.Offset = {
                                    top: [0, 0],
                                    'top-left': [0, 0],
                                    'top-right': [0, 0],
                                    bottom: [0, -markerHeight],
                                    'bottom-left': [
                                        linearOffset,
                                        (markerHeight -
                                            markerRadius +
                                            linearOffset) *
                                            -1,
                                    ],
                                    'bottom-right': [
                                        -linearOffset,
                                        (markerHeight -
                                            markerRadius +
                                            linearOffset) *
                                            -1,
                                    ],
                                    left: [
                                        markerRadius,
                                        (markerHeight - markerRadius) * -1,
                                    ],
                                    right: [
                                        -markerRadius,
                                        (markerHeight - markerRadius) * -1,
                                    ],
                                };
                                const popup = new mapboxgl.Popup({
                                    offset: popupOffsets,
                                    className: 'map-popup',
                                })
                                    .setLngLat(e.lngLat)
                                    .setHTML(
                                        `<div style="padding:0.5rem"><h2 style="padding-left: 3px">${locality.Name}</h2><table><tr><td style="font-weight: bold">Rank</td><td>${this.geoJsonData.features.findIndex(f => f.properties['wa_local_2'] === locality.Name.toUpperCase())}/${this.geoJsonData.features.length}</td></tr><tr><td style="font-weight: bold">Crime Rate</td><td>${
                                            population > 100
                                                ? (
                                                      offenceCount / population
                                                  ).toFixed(2)
                                                : 'Insufficient data'
                                        }</td></tr></table></div>`
                                    )
                                    .setMaxWidth('300px')
                                    .addTo(this.map);
                            }
                        }
                    );
                });
            }
        );
    }

    recalculateCrimeRates() {
        this.geoJsonData.features.forEach((f) => {
            const locality: string = f.properties['wa_local_2'];

            const population: number = this.populations[locality];

            let offenceCount = 0;

            const stats = this.localityStats.find(
                (s) => s[0].Locality === this.toTitleCase(locality)
            );

            if (stats) {
                const thisYearStats = stats.filter(
                    (s) => s.FinancialYear === FinancialYears['2021-22']
                );

                thisYearStats.forEach((s) => {
                    if (this.selectedOffenceFilters.includes(s.Offence)) {
                        offenceCount += +s.TotalAnnual;
                    }
                });
            }

            f.properties['crime-rate'] =
                (population >= 100)
                    ? +((offenceCount * 100) / population).toFixed(2)
                    : NaN;
        });

        const filtered = this.geoJsonData.features.filter(f => f.properties['crime-rate'] >= 0);

        filtered.sort((a, b) => {
            if (+a.properties['crime-rate'] > +b.properties['crime-rate']) {
                return 1;
            }
            if (+a.properties['crime-rate'] < +b.properties['crime-rate']) {
                return -1;
            }
            return 0;
        });

        this.filteredGeoJsonData.features = filtered;

        const rates = filtered.map(f => f.properties['crime-rate']);

        const suburbs = this.geoJsonData.features.filter(
            (f) => f.properties['crime-rate'] >= 0
        );

        this.highestCrimeRateLocalities = suburbs.slice(-10).reverse();
        this.lowestCrimeRateLocalities = suburbs.slice(0, 10);

        if (this.map) {
            (
                this.map.getSource('westernAustralia') as mapboxgl.GeoJSONSource
            ).setData(this.geoJsonData);
        }
    }

    toggleOffenceFilter(offence: Offences): void {
        const index = this.selectedOffenceFilters.findIndex(
            (o) => o === offence
        );
        if (index > -1) {
            this.selectedOffenceFilters.splice(index, 1);
        } else {
            this.selectedOffenceFilters.push(offence);
        }

        const checkbox: HTMLInputElement = (document.getElementById('selectAll') as HTMLInputElement);
        
        checkbox.indeterminate = this.selectedOffenceFilters.length > 0 && this.selectedOffenceFilters.length < this.offenceList.length;

        this.recalculateCrimeRates();
    }

    toggleAllFilters() {
        const checkbox: HTMLInputElement = (document.getElementById('selectAll') as HTMLInputElement);
        checkbox.indeterminate = false

        if (this.selectedOffenceFilters.length > 0) {
            this.selectedOffenceFilters = [];
        } else {
            this.selectedOffenceFilters = [...this.offenceList];
        }

        this.recalculateCrimeRates();
    }

    isOffenceSelected(offence: Offences): boolean {
        return this.selectedOffenceFilters.findIndex((o) => o === offence) > -1;
    }
}

import json
import math
import requests
from arcgis.gis import GIS
from arcgis.features import FeatureLayer
from arcgis.geometry import Geometry
from arcgis.geometry.functions import project

# --- CONFIGURATION ---
FEATURE_LAYER_URL = "https://services5.arcgis.com/FZTIUdZkataugPvd/arcgis/rest/services/DESIR_Senderos_Nafarmendi/FeatureServer/0"

# Credentials (if needed for editing)
USERNAME = "" 
PASSWORD = ""

# API Token (paste your token here if you have one)
TOKEN = ""  # Paste your token here

# Field to store the JSON profile
PROFILE_FIELD = "elevation_profile"

# Esri World Elevation Service
ELEVATION_SAMPLE_URL = "https://elevation.arcgis.com/arcgis/rest/services/WorldElevation/Terrain/ImageServer/getSamples"

def calculate_geodesic_distance(lat1, lon1, lat2, lon2):
    """Calculates geodesic distance in meters using Haversine formula."""
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c

def sample_elevation_rest(points_geojson):
    """
    Query elevation using REST API for a list of points.
    points_geojson: GeoJSON-like geometry with points
    Returns: list of elevation values
    """
    try:
        params = {
            'geometry': json.dumps(points_geojson),
            'geometryType': 'esriGeometryMultipoint',
            'returnFirstValueOnly': 'false',
            'interpolation': 'RSP_BilinearInterpolation',
            'f': 'json'
        }
        
        # Add token if available
        if TOKEN:
            params['token'] = TOKEN
        
        response = requests.get(ELEVATION_SAMPLE_URL, params=params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if 'samples' in data:
                # Extract elevation values
                elevations = [sample.get('value', 0) for sample in data['samples']]
                return elevations
        
        print(f"    Elevation API response error: {response.text[:200]}")
        return None
        
    except Exception as e:
        print(f"    Error querying elevation REST API: {e}")
        return None

def get_elevation_for_geometry(geom):
    """
    Get elevation profile for a polyline geometry.
    Returns list of [distance_km, elevation_m] or None.
    """
    try:
        # Ensure geometry is in WGS84
        if geom.get("spatialReference", {}).get("wkid") not in [4326, None]:
            geom_wgs84 = project([Geometry(geom)], 
                                in_sr=geom.get("spatialReference"), 
                                out_sr=4326)[0]
        else:
            geom_wgs84 = geom
        
        paths = geom_wgs84['paths'][0]  # Assume single part
        
        # Check if already has Z values
        has_z = len(paths[0]) > 2
        
        if has_z:
            print("  Using existing Z values from geometry")
            elevations = [p[2] for p in paths]
        else:
            print("  Querying elevation from REST API...")
            
            # Build multipoint geometry for elevation query
            points_geom = {
                "points": [[p[0], p[1]] for p in paths],
                "spatialReference": {"wkid": 4326}
            }
            
            elevations = sample_elevation_rest(points_geom)
            
            if elevations is None or len(elevations) != len(paths):
                print(f"  WARNING: Failed to get elevations (got {len(elevations) if elevations else 0}, expected {len(paths)})")
                return None
        
        # Calculate profile with distances
        profile_data = []
        cumulative_dist = 0  # meters
        
        for i in range(len(paths)):
            p = paths[i]
            lon, lat = p[0], p[1]
            elev = elevations[i]
            
            if i > 0:
                prev_p = paths[i-1]
                dist_seg = calculate_geodesic_distance(prev_p[1], prev_p[0], lat, lon)
                cumulative_dist += dist_seg
            
            # Store as [distance_km, elevation_m]
            profile_data.append([round(cumulative_dist / 1000.0, 3), round(elev, 1)])
        
        return profile_data
        
    except Exception as e:
        print(f"    Error in get_elevation_for_geometry: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    print("=" * 60)
    print("Elevation Profile Update Script")
    print("=" * 60)
    
    print("\nConnecting to ArcGIS Online...")
    try:
        if USERNAME and PASSWORD:
            gis = GIS("https://www.arcgis.com", USERNAME, PASSWORD)
            print("Connected with credentials")
        else:
            gis = GIS()
            print("Connected anonymously")
    except Exception as e:
        print(f"Failed to connect: {e}")
        return

    print(f"\nAccessing layer:\n{FEATURE_LAYER_URL}")
    try:
        layer = FeatureLayer(FEATURE_LAYER_URL, gis=gis)
    except Exception as e:
        print(f"Error accessing layer: {e}")
        return

    print("\nQuerying features...")
    try:
        feature_set = layer.query(where="1=1", out_fields="*", return_geometry=True)
        features = feature_set.features
    except Exception as e:
        print(f"Error querying features: {e}")
        return

    print(f"Found {len(features)} features.\n")
    print("=" * 60)

    updates = []

    for idx, f in enumerate(features, 1):
        oid = f.attributes['OBJECTID']
        name = f.attributes.get('name_1', 'Unknown')
        
        print(f"\n[{idx}/{len(features)}] Route: {name} (OID: {oid})")
        
        try:
            geom = f.geometry
            
            if not geom or 'paths' not in geom or not geom['paths']:
                print("  ERROR: No valid geometry found")
                continue
            
            profile_data = get_elevation_for_geometry(geom)
            
            if profile_data:
                # Update feature
                f.attributes[PROFILE_FIELD] = json.dumps(profile_data)
                updates.append(f)
                print(f"  ✓ Profile generated: {len(profile_data)} points")
            else:
                print(f"  ✗ Failed to generate profile")

        except Exception as e:
            print(f"  ERROR: {e}")
            import traceback
            traceback.print_exc()

    # Apply edits
    print("\n" + "=" * 60)
    if updates:
        print(f"\nUpdating {len(updates)} features in the layer...")
        try:
            result = layer.edit_features(updates=updates)
            
            if result.get('updateResults'):
                success_count = sum(1 for r in result['updateResults'] if r.get('success'))
                print(f"✓ Successfully updated: {success_count}/{len(updates)} features")
                
                if success_count < len(updates):
                    print("\nFailed updates:")
                    for r in result['updateResults']:
                        if not r.get('success'):
                            print(f"  - OID {r.get('objectId')}: {r.get('error', {}).get('description', 'Unknown error')}")
            else:
                print("Update result:", result)
                
        except Exception as e:
            print(f"✗ Error applying edits: {e}")
            import traceback
            traceback.print_exc()
    else:
        print("\nNo features to update.")

    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)

if __name__ == "__main__":
    main()

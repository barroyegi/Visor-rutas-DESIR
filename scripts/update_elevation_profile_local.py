"""
Script to populate elevation_profile field for a local Feature Class.
Requires: ArcGIS Pro with arcpy and 3D Analyst extension

Usage:
1. Download your feature layer as a Feature Class to a local geodatabase
2. Update FC_PATH below to point to your feature class
3. Ensure you have a DEM raster if needed, or use existing Z values
4. Run this script in ArcGIS Pro Python environment
5. Upload the updated Feature Class back to ArcGIS Online
"""

import arcpy
import json
import math

# --- CONFIGURATION ---
# Path to your local Feature Class
FC_PATH = r"C:\path\to\your\geodatabase.gdb\your_feature_class"

# Field to store the JSON profile
PROFILE_FIELD = "elevation_profile"

# Optional: Path to DEM raster if geometry doesn't have Z values
DEM_RASTER = None  # e.g., r"C:\path\to\dem.tif" or None if not needed

# Fallback surface for Interpolate Shape (Local DEM or Esri World Elevation Service)
# Esri Service URL: https://elevation.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer
FALLBACK_SURFACE = r"https://elevation.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer"

def calculate_geodesic_distance(lat1, lon1, lat2, lon2):
    """Calcula la distancia geodesica en metros usando la formula Haversine."""
    R = 6371000  # Radio de la tierra
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c

def is_profile_valid(profile_data):
    """
    Checks if the elevation profile has meaningful variation.
    Returns False if profile is empty, all elevations are the same, 
    or variation is below threshold.
    """
    if not profile_data or len(profile_data) < 2:
        return False
        
    elevations = [p[1] for p in profile_data]
    min_elev = min(elevations)
    max_elev = max(elevations)
    
    # Threshold for variation (meters)
    # If the difference between max and min is less than 0.5m, it's likely a flat/invalid profile
    if (max_elev - min_elev) < 0.5:
        return False
        
    return True

def extract_from_geometry(geometry):
    """Helper to extract [dist, elev] points from geometry."""
    profile_data = []
    points = []
    
    # Get all points from the polyline
    for part in geometry:
        for point in part:
            if point:
                points.append(point)
    
    if not points:
        return None
        
    cumulative_dist = 0  # meters
    for i, point in enumerate(points):
        if i > 0:
            prev = points[i-1]
            # Calculate distance
            dist_seg = calculate_geodesic_distance(prev.Y, prev.X, point.Y, point.X)
            cumulative_dist += dist_seg
        
        # Get elevation (Z value)
        elev = point.Z if point.Z is not None else 0
        
        # Store as [distance_km, elevation_m]
        profile_data.append([round(cumulative_dist / 1000.0, 3), round(elev, 1)])
        
    return profile_data

def get_elevation_profile(geometry, dem_raster=None, fallback_surface=None):
    """
    Extract elevation profile from polyline geometry.
    Tries Method A (Geometry Z) first.
    If Method A is invalid and fallback_surface is provided:
        - Tries Method B (InterpolateShape) if 3D Analyst license is available.
        - Tries Method C (Manual Sampling) if no license.
    """
    try:
        # Method A: Direct from Geometry
        profile_data = extract_from_geometry(geometry)
        
        if is_profile_valid(profile_data):
            return profile_data, "Geometry"
            
        # Method B/C: Fallback to Surface
        if fallback_surface:
            # Check for 3D Analyst license
            has_3d = arcpy.CheckExtension("3D") == "Available"
            
            if has_3d:
                # Method B: InterpolateShape (Fast, requires license)
                print(f"    Interpolating from surface (3D Analyst): {fallback_surface}...")
                try:
                    arcpy.CheckOutExtension("3D")
                    temp_fc = r"memory\temp_3d_line"
                    if arcpy.Exists(temp_fc):
                        arcpy.management.Delete(temp_fc)
                        
                    arcpy.ddd.InterpolateShape(fallback_surface, geometry, temp_fc)
                    
                    with arcpy.da.SearchCursor(temp_fc, ["SHAPE@"]) as scursor:
                        for row in scursor:
                            profile_data = extract_from_geometry(row[0])
                            break
                    
                    arcpy.management.Delete(temp_fc)
                    arcpy.CheckInExtension("3D")
                    
                    if is_profile_valid(profile_data):
                        return profile_data, "Surface (3D Analyst)"
                except Exception as e:
                    print(f"    Error during surface interpolation: {e}")
                    arcpy.CheckInExtension("3D")
            
            # Method C: Manual Sampling (Slower, no license required)
            print(f"    Sampling from surface (Manual): {fallback_surface}...")
            profile_data = extract_from_surface_no_license(geometry, fallback_surface)
            if is_profile_valid(profile_data):
                return profile_data, "Surface (Manual)"
                
        return None, None
        
    except Exception as e:
        print(f"    Error extracting profile: {e}")
        import traceback
        traceback.print_exc()
        return None, None

def extract_from_surface_no_license(geometry, surface_path):
    """
    Extracts elevation by sampling the surface at each vertex using GetCellValue.
    Works without 3D Analyst license. Supports local rasters and WCS.
    """
    profile_data = []
    points = []
    for part in geometry:
        for point in part:
            if point:
                points.append(point)
    
    if not points:
        return None
        
    cumulative_dist = 0
    for i, point in enumerate(points):
        if i > 0:
            prev = points[i-1]
            dist_seg = calculate_geodesic_distance(prev.Y, prev.X, point.Y, point.X)
            cumulative_dist += dist_seg
        
        # Sample elevation from surface
        try:
            # GetCellValue returns a Result object; .getOutput(0) is the string value
            res = arcpy.management.GetCellValue(surface_path, f"{point.X} {point.Y}")
            val_str = res.getOutput(0)
            
            # Handle NoData or non-numeric results
            if val_str.lower() in ["nodata", "failed", ""]:
                elev = 0
            else:
                # Convert to float, handling potential localized decimal separators
                elev = float(val_str.replace(',', '.'))
        except Exception:
            elev = 0
            
        profile_data.append([round(cumulative_dist / 1000.0, 3), round(elev, 1)])
        
    return profile_data

def main():
    print("=" * 60)
    print("Local Elevation Profile Update Script")
    print("=" * 60)
    
    # Check if feature class exists
    if not arcpy.Exists(FC_PATH):
        print(f"\nERROR: Feature class not found: {FC_PATH}")
        print("\nPlease update FC_PATH in the script to point to your feature class.")
        return
    
    print(f"\nFeature Class: {FC_PATH}")
    
    # Check if field exists
    field_names = [f.name for f in arcpy.ListFields(FC_PATH)]
    if PROFILE_FIELD not in field_names:
        print(f"\nField '{PROFILE_FIELD}' not found. Creating it...")
        arcpy.management.AddField(FC_PATH, PROFILE_FIELD, "TEXT", field_length=10000)
        print("Field created.")
    
    # Count features
    count = int(arcpy.management.GetCount(FC_PATH)[0])
    print(f"Total features: {count}\n")
    print("=" * 60)
    
    # Process features
    success_count = 0
    fail_count = 0
    invalid_count = 0
    
    with arcpy.da.UpdateCursor(FC_PATH, ["OID@", "SHAPE@", PROFILE_FIELD]) as cursor:
        for idx, (oid, geometry, current_profile) in enumerate(cursor, 1):
            try:
                print(f"\n[{idx}/{count}] Processing OID: {oid}")
                
                if not geometry:
                    print("  WARNING: No geometry")
                    fail_count += 1
                    continue
                
                # Get elevation profile
                profile_data, method = get_elevation_profile(geometry, DEM_RASTER, FALLBACK_SURFACE)
                
                if profile_data:
                    # Convert to JSON
                    profile_json = json.dumps(profile_data)
                    
                    # Update the row
                    cursor.updateRow([oid, geometry, profile_json])
                    
                    print(f"  ✓ Profile updated ({method}): {len(profile_data)} points")
                    success_count += 1
                else:
                    # If get_elevation_profile returned None, it might be horizontal or failed
                    print("  ✗ Profile skipped (invalid or failed)")
                    invalid_count += 1
                    
            except Exception as e:
                print(f"  ERROR: {e}")
                fail_count += 1
                import traceback
                traceback.print_exc()
    
    # Summary
    print("\n" + "=" * 60)
    print("\nSummary:")
    print(f"  Successfully updated: {success_count}")
    print(f"  Skipped (Horizontal/Invalid): {invalid_count}")
    print(f"  Failed (Errors): {fail_count}")
    print(f"  Total: {count}")
    print("\n" + "=" * 60)
    print("Done!")
    print("\nNext steps:")
    print("1. Verify the elevation_profile field has been populated")
    print("2. Upload this feature class back to ArcGIS Online")
    print("3. Refresh your web app to test")
    print("=" * 60)

if __name__ == "__main__":
    main()

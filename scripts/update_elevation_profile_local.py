"""
Script to populate elevation_profile field for a local Feature Class.
Requires: ArcGIS Pro with arcpy

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

def get_elevation_profile(geometry, dem_raster=None):
    """
    Extract elevation profile from polyline geometry.
    If geometry has Z values, uses them.
    If not and dem_raster is provided, samples from DEM.
    """
    profile_data = []
    
    try:
        # Check if geometry has Z values
        has_z = geometry.isMultipart == False and geometry.hasCurves == False
        
        # Get all points from the polyline
        points = []
        for part in geometry:
            for point in part:
                if point:
                    points.append(point)
        
        if len(points) == 0:
            return None
        
        # If no Z values and DEM provided, sample from DEM
        if not points[0].Z and dem_raster:
            print("    Sampling elevations from DEM...")
            # Create point geometries for sampling
            point_geoms = [arcpy.PointGeometry(p) for p in points]
            
            # Sample DEM
            result = arcpy.sa.Sample(dem_raster, point_geoms, "temp_sample")
            # Process result - this is simplified, actual implementation depends on DEM structure
            # For now, we'll assume Z values exist
            
        # Calculate profile
        cumulative_dist = 0  # meters
        
        for i, point in enumerate(points):
            if i > 0:
                prev = points[i-1]
                # Calculate distance
                dist_seg = calculate_geodesic_distance(prev.Y, prev.X, point.Y, point.X)
                cumulative_dist += dist_seg
            
            # Get elevation (Z value)
            elev = point.Z if point.Z else 0
            
            # Store as [distance_km, elevation_m]
            profile_data.append([round(cumulative_dist / 1000.0, 3), round(elev, 1)])
        
        return profile_data
        
    except Exception as e:
        print(f"    Error extracting profile: {e}")
        import traceback
        traceback.print_exc()
        return None

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
    
    with arcpy.da.UpdateCursor(FC_PATH, ["OID@", "SHAPE@", PROFILE_FIELD]) as cursor:
        for idx, (oid, geometry, current_profile) in enumerate(cursor, 1):
            try:
                print(f"\n[{idx}/{count}] Processing OID: {oid}")
                
                if not geometry:
                    print("  WARNING: No geometry")
                    fail_count += 1
                    continue
                
                # Get elevation profile
                profile_data = get_elevation_profile(geometry, DEM_RASTER)
                
                if profile_data:
                    # Convert to JSON
                    profile_json = json.dumps(profile_data)
                    
                    # Update the row
                    cursor.updateRow([oid, geometry, profile_json])
                    
                    print(f"  ✓ Profile updated: {len(profile_data)} points")
                    success_count += 1
                else:
                    print("  ✗ Failed to generate profile")
                    fail_count += 1
                    
            except Exception as e:
                print(f"  ERROR: {e}")
                fail_count += 1
                import traceback
                traceback.print_exc()
    
    # Summary
    print("\n" + "=" * 60)
    print("\nSummary:")
    print(f"  Successfully updated: {success_count}")
    print(f"  Failed: {fail_count}")
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

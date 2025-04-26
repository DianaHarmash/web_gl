export default function StereoCamera(
    eyeSeparation,  
    convergence,
    aspectRatio,
    FOV,
    nearClippingDistance,
    farClippingDistance)
{
    this.eyeSeparation = eyeSeparation;         // Distance between eyes (interpupillary distance)
    this.convergence = convergence;             // Distance to the convergence plane
    this.mAspectRatio = aspectRatio;            // Aspect ratio of the viewing window
    this.FOV = FOV;                             // Field of view in radians
    this.nearClippingDistance = nearClippingDistance;   // Distance to near clipping plane
    this.farClippingDistance = farClippingDistance;     // Distance to far clipping plane
    
    // Calculate the left eye frustum
    this.calcLeftFrustum = function()
    {
        let top, bottom, left, right;
        top = this.nearClippingDistance * Math.tan(this.FOV / 2);
        bottom = -top;
        let a = this.mAspectRatio * Math.tan(this.FOV / 2) * this.convergence;
        let b = a - this.eyeSeparation / 2;
        let c = a + this.eyeSeparation / 2;
        left = -b * this.nearClippingDistance / this.convergence;
        right = c * this.nearClippingDistance / this.convergence;
        return m4.frustum(left, right, bottom, top, this.nearClippingDistance, this.farClippingDistance);
    }
    
    // Calculate the right eye frustum
    this.calcRightFrustum = function()
    {
        let top, bottom, left, right;
        top = this.nearClippingDistance * Math.tan(this.FOV / 2);
        bottom = -top;
        let a = this.mAspectRatio * Math.tan(this.FOV / 2) * this.convergence;
        let b = a - this.eyeSeparation / 2;
        let c = a + this.eyeSeparation / 2;
        left = -c * this.nearClippingDistance / this.convergence;
        right = b * this.nearClippingDistance / this.convergence;
        return m4.frustum(left, right, bottom, top, this.nearClippingDistance, this.farClippingDistance);
    }
}